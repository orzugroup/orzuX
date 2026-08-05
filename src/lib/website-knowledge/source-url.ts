import type { ExtractedKnowledgeEntry } from "@/lib/website-knowledge/extract-entries";

export function assignUniqueKnowledgeSourceUrls(
  entries: ExtractedKnowledgeEntry[],
): ExtractedKnowledgeEntry[] {
  const seen = new Set<string>();

  return entries.map((entry, index) => {
    const pageUrl = entry.sourceUrl.split("#")[0]?.trim() || "website-sync";
    let sourceUrl = `${pageUrl}#${slugifyFragment(entry.title)}-${index + 1}`;

    while (seen.has(sourceUrl)) {
      sourceUrl = `${sourceUrl}-x`;
    }

    seen.add(sourceUrl);
    return { ...entry, sourceUrl };
  });
}

function slugifyFragment(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || "fact";
}
