import "server-only";

import { getGeminiModel } from "@/lib/gemini";
import { GEMINI_SAFETY_SETTINGS } from "@/lib/gemini/prompts";
import { getGeminiDefaultModel, hasGeminiEnv } from "@/lib/env";
import {
  KNOWLEDGE_CATEGORIES,
  resolveKnowledgeCategory,
} from "@/features/knowledge-base/categories";
import type { CrawledPage } from "@/lib/website-knowledge/crawler";
import { truncateText } from "@/lib/website-knowledge/html-text";
import { organizeWebsiteKnowledgeWithClaude } from "@/lib/website-knowledge/claude-knowledge-organizer";
import { assignUniqueKnowledgeSourceUrls } from "@/lib/website-knowledge/source-url";
import { hasClaudeEnv } from "@/services/claude.service";
import type { KnowledgeEntryMetadata } from "@/types/knowledge-category.types";

export type ExtractedKnowledgeEntry = {
  title: string;
  content: string;
  category: string;
  sourceUrl: string;
  metadata: KnowledgeEntryMetadata;
};

const MAX_ENTRIES_PER_PAGE = 6;
const MAX_TOTAL_ENTRIES = 80;
const MIN_CONTENT_LENGTH = 40;
const MIN_TITLE_LENGTH = 3;

const CATEGORY_ORDER = new Map(
  KNOWLEDGE_CATEGORIES.map((category, index) => [category.toLowerCase(), index]),
);

const JUNK_TITLE_PATTERNS = [
  /^(home|menu|nav|navigation|skip to|cookie|privacy policy|terms of use|sign in|log in|register|subscribe|follow us|share|cart|checkout|search)$/i,
  /click here|read more|learn more|get started|buy now|add to cart/i,
];

const JUNK_CONTENT_PATTERNS = [
  /this website uses cookies/i,
  /all rights reserved/i,
  /lorem ipsum/i,
  /javascript is required/i,
  /enable cookies/i,
];

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isJunkEntry(title: string, content: string): boolean {
  if (title.length < MIN_TITLE_LENGTH || content.length < MIN_CONTENT_LENGTH) {
    return true;
  }

  if (JUNK_TITLE_PATTERNS.some((pattern) => pattern.test(title.trim()))) {
    return true;
  }

  if (JUNK_CONTENT_PATTERNS.some((pattern) => pattern.test(content))) {
    return true;
  }

  // Too vague / marketing fluff without facts
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  if (wordCount < 8) {
    return true;
  }

  return false;
}

function parseGeminiJsonPayload(
  raw: string,
  sourceUrl: string,
): ExtractedKnowledgeEntry[] {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned) as {
    entries?: Array<{
      title?: string;
      content?: string;
      category?: string;
      price?: string;
      skip?: boolean;
    }>;
  };

  if (!Array.isArray(parsed.entries)) {
    return [];
  }

  return parsed.entries
    .filter((entry) => !entry.skip)
    .filter((entry) => entry.title?.trim() && entry.content?.trim())
    .map((entry) => {
      const title = entry.title!.trim().slice(0, 200);
      const content = entry.content!.trim().slice(0, 5000);
      const category = resolveKnowledgeCategory(entry.category ?? "Additional");
      const price = entry.price?.trim();

      return {
        title,
        content,
        category,
        sourceUrl,
        metadata: price ? { price: price.slice(0, 80) } : {},
      };
    })
    .filter((entry) => !isJunkEntry(entry.title, entry.content))
    .slice(0, MAX_ENTRIES_PER_PAGE);
}

function sortEntries(entries: ExtractedKnowledgeEntry[]): ExtractedKnowledgeEntry[] {
  return [...entries].sort((left, right) => {
    const leftOrder =
      CATEGORY_ORDER.get(left.category.toLowerCase()) ??
      KNOWLEDGE_CATEGORIES.length;
    const rightOrder =
      CATEGORY_ORDER.get(right.category.toLowerCase()) ??
      KNOWLEDGE_CATEGORIES.length;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.title.localeCompare(right.title, undefined, {
      sensitivity: "base",
    });
  });
}

function dedupeEntries(
  entries: ExtractedKnowledgeEntry[],
): ExtractedKnowledgeEntry[] {
  const byExact = new Map<string, ExtractedKnowledgeEntry>();

  for (const entry of entries) {
    const key = `${normalizeKey(entry.category)}|${normalizeKey(entry.title)}`;
    const existing = byExact.get(key);

    if (!existing || entry.content.length > existing.content.length) {
      byExact.set(key, entry);
    }
  }

  const result: ExtractedKnowledgeEntry[] = [];

  for (const entry of byExact.values()) {
    const nearDuplicate = result.find((item) => {
      if (normalizeKey(item.category) !== normalizeKey(entry.category)) {
        return false;
      }

      const a = normalizeKey(item.content);
      const b = normalizeKey(entry.content);
      if (a === b) return true;
      if (a.includes(b) || b.includes(a)) return true;

      const titleA = normalizeKey(item.title);
      const titleB = normalizeKey(entry.title);
      return titleA === titleB;
    });

    if (nearDuplicate) {
      if (entry.content.length > nearDuplicate.content.length) {
        Object.assign(nearDuplicate, entry);
      }
      continue;
    }

    result.push(entry);
  }

  return result;
}

async function curateEntriesWithAi(
  entries: ExtractedKnowledgeEntry[],
  siteUrl: string,
  model: ReturnType<typeof getGeminiModel>,
): Promise<ExtractedKnowledgeEntry[]> {
  if (entries.length <= 4) {
    return entries;
  }

  const compact = entries.slice(0, MAX_TOTAL_ENTRIES).map((entry, index) => ({
    i: index,
    t: entry.title,
    c: entry.content.slice(0, 500),
    cat: entry.category,
    p: entry.metadata.price ?? "",
  }));

  const prompt = [
    "You curate a business knowledge base for an AI customer-support agent.",
    `Website: ${siteUrl}`,
    "You receive candidate entries extracted from the site. Clean them up.",
    "",
    "Return ONLY valid JSON (no markdown):",
    '{"entries":[{"title":"...","content":"...","category":"Services|Pricing|FAQ|Business Hours|Address|Contact|Policies|Additional","price":"optional"}]}',
    "",
    "Strict rules:",
    "- Keep only useful customer facts (services, prices, hours, address, contact, FAQ, policies).",
    "- Drop navigation, marketing slogans, cookie notices, login CTAs, SEO fluff, duplicates.",
    "- Merge near-duplicates into one stronger entry.",
    "- Prefer standard categories listed above. Use Additional only when nothing else fits.",
    "- Do NOT invent facts. Only rewrite for clarity using given content.",
    "- Put price in `price` when known; keep service names in Services.",
    `- Return at most ${MAX_TOTAL_ENTRIES} high-quality entries, ordered by category then title.`,
    "",
    "Candidates JSON:",
    JSON.stringify(compact),
  ].join("\n");

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      safetySettings: [...GEMINI_SAFETY_SETTINGS],
    });

    const text = result.response.text()?.trim();
    if (!text) {
      return entries;
    }

    const curated = parseGeminiJsonPayload(text, siteUrl).map((entry) => ({
      ...entry,
      sourceUrl: entry.sourceUrl || siteUrl,
    }));

    return curated.length > 0 ? curated : entries;
  } catch {
    return entries;
  }
}

function basicEntriesFromPages(pages: CrawledPage[]): ExtractedKnowledgeEntry[] {
  return pages.map((page) => ({
    title: page.title.slice(0, 200) || "Page",
    content: truncateText(page.text, 3_000),
    category: resolveKnowledgeCategory("Additional"),
    sourceUrl: page.url,
    metadata: {},
  }));
}

export async function extractKnowledgeEntriesFromPages(
  pages: CrawledPage[],
  siteUrl: string,
  businessId?: string,
): Promise<ExtractedKnowledgeEntry[]> {
  if (pages.length === 0) {
    return [];
  }

  const canUseGemini = hasGeminiEnv();
  const canUseClaude = hasClaudeEnv();

  if (!canUseGemini && !canUseClaude) {
    return [];
  }

  const model = canUseGemini
    ? getGeminiModel({ model: getGeminiDefaultModel() })
    : null;
  const allEntries: ExtractedKnowledgeEntry[] = [];
  const categoryList = KNOWLEDGE_CATEGORIES.join("|");

  if (!canUseGemini) {
    allEntries.push(...basicEntriesFromPages(pages));
  } else {
  for (const page of pages) {
    if (allEntries.length >= MAX_TOTAL_ENTRIES) {
      break;
    }

    const prompt = [
      "You extract ONLY high-value business facts from one website page for an AI support agent knowledge base.",
      `Website: ${siteUrl}`,
      `Page URL: ${page.url}`,
      `Page title: ${page.title}`,
      "",
      "Return ONLY valid JSON (no markdown):",
      `{"entries":[{"title":"short title","content":"clear factual details","category":"${categoryList}","price":"optional price string"}]}`,
      "",
      "Include:",
      "- Concrete services/products with what they are and how they work",
      "- Prices/packages when shown on this page",
      "- FAQ answers, hours, address/service areas, contact channels, policies",
      "",
      "EXCLUDE / return empty entries array if the page is mostly:",
      "- Navigation, menus, footers, cookie banners, legal boilerplate alone",
      "- Login/signup/cart/checkout/search pages",
      "- Vague marketing slogans without actionable facts",
      "- Blog fluff without business facts",
      "",
      "Rules:",
      `- Max ${MAX_ENTRIES_PER_PAGE} entries from THIS page.`,
      "- One fact/service/FAQ per entry. Self-contained content (complete sentences).",
      "- Prefer standard categories only. Map prices into Pricing or put price field on Services.",
      "- Do not invent prices or claims. Use only page facts.",
      "- If nothing useful: {\"entries\":[]}",
      "",
      "Page text:",
      truncateText(page.text, 10_000),
    ].join("\n");

    try {
      const result = await model!.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        safetySettings: [...GEMINI_SAFETY_SETTINGS],
      });

      const text = result.response.text()?.trim();
      if (!text) {
        continue;
      }

      const entries = parseGeminiJsonPayload(text, page.url).map((entry) => ({
        ...entry,
        sourceUrl: `${page.url}#${entry.title.slice(0, 40).replace(/\s+/g, "-").toLowerCase()}`,
      }));

      allEntries.push(...entries);
    } catch {
      continue;
    }
  }
  }

  const deduped = dedupeEntries(allEntries);
  let curated = deduped;

  if (businessId && canUseClaude) {
    curated = await organizeWebsiteKnowledgeWithClaude({
      businessId,
      siteUrl,
      pages,
      seedEntries: deduped,
    });
  } else if (model) {
    curated = await curateEntriesWithAi(deduped, siteUrl, model);
  }

  const finalEntries = assignUniqueKnowledgeSourceUrls(
    sortEntries(dedupeEntries(curated)).slice(0, MAX_TOTAL_ENTRIES),
  );

  return finalEntries;
}
