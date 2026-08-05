import { extractLinksFromHtml, htmlToPlainText, truncateText } from "@/lib/website-knowledge/html-text";
import { expandWebsiteStartUrls } from "@/lib/website-knowledge/url-variants";

export type CrawledPage = {
  url: string;
  title: string;
  text: string;
};

const MAX_PAGES = 48;
const MAX_DEPTH = 3;
const FETCH_TIMEOUT_MS = 15_000;
const FETCH_RETRIES = 2;
const MIN_TEXT_LENGTH = 120;
const MAX_TEXT_PER_PAGE = 12_000;

const SKIP_EXTENSIONS = /\.(pdf|zip|rar|7z|png|jpe?g|gif|webp|svg|ico|mp4|mp3|woff2?|ttf|css|js)(\?|$)/i;

function normalizeSiteUrl(url: string): string {
  const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "") || parsed.origin;
}

function getHostname(url: string): string {
  return new URL(url).hostname.replace(/^www\./, "");
}

function shouldSkipUrl(url: string): boolean {
  if (SKIP_EXTENSIONS.test(url)) {
    return true;
  }

  const lower = url.toLowerCase();

  return (
    lower.includes("/wp-admin") ||
    lower.includes("/cart") ||
    lower.includes("/checkout") ||
    lower.includes("/login") ||
    lower.includes("/logout")
  );
}

function extractTitleFromHtml(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? htmlToPlainText(match[1]).slice(0, 200) : "Page";
}

async function fetchPage(url: string): Promise<string | null> {
  for (let attempt = 0; attempt <= FETCH_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "OrzuX-KnowledgeSync/1.0 (+https://orzux.com)",
          Accept: "text/html,application/xhtml+xml",
        },
        cache: "no-store",
        redirect: "follow",
      });

      if (!response.ok) {
        if (attempt < FETCH_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
          continue;
        }
        return null;
      }

      const contentType = response.headers.get("content-type") ?? "";

      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
        return null;
      }

      return await response.text();
    } catch {
      if (attempt < FETCH_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
        continue;
      }
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
}

export async function crawlWebsite(startUrlInput: string): Promise<CrawledPage[]> {
  const startUrl = normalizeSiteUrl(startUrlInput);
  const originHost = getHostname(startUrl);
  const visited = new Set<string>();
  const queue: Array<{ url: string; depth: number }> = [{ url: startUrl, depth: 0 }];
  const pages: CrawledPage[] = [];

  while (queue.length > 0 && pages.length < MAX_PAGES) {
    const current = queue.shift();

    if (!current || visited.has(current.url)) {
      continue;
    }

    visited.add(current.url);

    if (shouldSkipUrl(current.url)) {
      continue;
    }

    const html = await fetchPage(current.url);

    if (!html) {
      continue;
    }

    const text = truncateText(htmlToPlainText(html), MAX_TEXT_PER_PAGE);

    if (text.length >= MIN_TEXT_LENGTH) {
      pages.push({
        url: current.url,
        title: extractTitleFromHtml(html),
        text,
      });
    }

    if (current.depth >= MAX_DEPTH) {
      continue;
    }

    for (const link of extractLinksFromHtml(html, current.url)) {
      if (visited.has(link) || shouldSkipUrl(link)) {
        continue;
      }

      try {
        const linkHost = getHostname(link);

        if (linkHost !== originHost) {
          continue;
        }

        queue.push({ url: link.replace(/\/$/, "") || link, depth: current.depth + 1 });
      } catch {
        continue;
      }
    }
  }

  return pages;
}

/** Try apex/www and http/https until at least one page is indexed. */
export async function crawlWebsiteWithFallback(
  startUrlInput: string,
): Promise<{ pages: CrawledPage[]; resolvedStartUrl: string }> {
  const candidates = expandWebsiteStartUrls(startUrlInput);
  let best: CrawledPage[] = [];
  let resolvedStartUrl = candidates[0] ?? startUrlInput;

  for (const candidate of candidates) {
    const pages = await crawlWebsite(candidate);

    if (pages.length > best.length) {
      best = pages;
      resolvedStartUrl = candidate;
    }

    if (pages.length >= 3) {
      return { pages, resolvedStartUrl: candidate };
    }
  }

  return { pages: best, resolvedStartUrl };
}
