/** Build candidate start URLs (apex/www, https) for resilient crawls. */
export function expandWebsiteStartUrls(urlInput: string): string[] {
  const parsed = new URL(
    urlInput.startsWith("http") ? urlInput : `https://${urlInput}`,
  );
  parsed.hash = "";
  parsed.search = "";

  const host = parsed.hostname.toLowerCase();
  const hasWww = host.startsWith("www.");
  const apexHost = hasWww ? host.slice(4) : host;
  const wwwHost = hasWww ? host : `www.${host}`;

  const paths = [parsed.pathname.replace(/\/$/, "") || ""];

  const candidates = new Set<string>();

  for (const scheme of ["https:", "http:"] as const) {
    for (const hostname of [apexHost, wwwHost]) {
      for (const path of paths) {
        const next = new URL(`${scheme}//${hostname}${path || "/"}`);
        next.hash = "";
        candidates.add(next.toString().replace(/\/$/, "") || next.origin);
      }
    }
  }

  return [...candidates];
}
