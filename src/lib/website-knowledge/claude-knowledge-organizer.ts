import "server-only";

import { resolveKnowledgeCategory } from "@/features/knowledge-base/categories";
import type { CrawledPage } from "@/lib/website-knowledge/crawler";
import type { ExtractedKnowledgeEntry } from "@/lib/website-knowledge/extract-entries";
import { truncateText } from "@/lib/website-knowledge/html-text";
import { generateClaudeKnowledgeJson, hasClaudeEnv } from "@/services/claude.service";
import { ensureSystemKnowledgeCategories } from "@/services/knowledge-categories.service";
import { createAdminClient } from "@/lib/supabase/admin";

const BATCH_SIZE = 5;
const MAX_TOTAL_ENTRIES = 80;

function parseClaudeEntriesPayload(
  raw: string,
  fallbackSourceUrl: string,
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
      sourcePageUrl?: string;
      price?: string;
    }>;
    categories?: string[];
  };

  if (!Array.isArray(parsed.entries)) {
    return [];
  }

  return parsed.entries
    .filter((entry) => entry.title?.trim() && entry.content?.trim())
    .map((entry) => ({
      title: entry.title!.trim().slice(0, 200),
      content: entry.content!.trim().slice(0, 5000),
      category: resolveKnowledgeCategory(entry.category ?? "Additional"),
      sourceUrl: (entry.sourcePageUrl ?? fallbackSourceUrl).trim(),
      metadata: entry.price?.trim()
        ? { price: entry.price.trim().slice(0, 80) }
        : {},
    }));
}

async function summarizePageBatch(
  pages: CrawledPage[],
  siteUrl: string,
  batchIndex: number,
): Promise<string> {
  const compact = pages.map((page) => ({
    url: page.url,
    title: page.title,
    text: truncateText(page.text, 4_000),
  }));

  const result = await generateClaudeKnowledgeJson({
    maxTokens: 2048,
    systemInstruction:
      "You extract factual business knowledge from website pages. Output concise bullet facts only.",
    prompt: [
      `Website: ${siteUrl}`,
      `Batch ${batchIndex + 1}`,
      "Summarize every useful customer-facing fact from these pages (services, pricing, hours, location, contact, FAQ, policies).",
      "Plain text bullets, no markdown.",
      JSON.stringify(compact),
    ].join("\n\n"),
  });

  return result.success ? result.text : compact.map((p) => `${p.title}: ${p.text.slice(0, 400)}`).join("\n");
}

async function loadCategoryNames(businessId: string): Promise<string[]> {
  await ensureSystemKnowledgeCategories(businessId);
  const admin = createAdminClient();
  const { data } = await admin
    .from("knowledge_categories")
    .select("name")
    .eq("business_id", businessId)
    .order("sort_order", { ascending: true });

  return (data ?? []).map((row) => row.name);
}

export async function organizeWebsiteKnowledgeWithClaude(input: {
  businessId: string;
  siteUrl: string;
  pages: CrawledPage[];
  seedEntries: ExtractedKnowledgeEntry[];
}): Promise<ExtractedKnowledgeEntry[]> {
  if (!hasClaudeEnv()) {
    return input.seedEntries;
  }

  const categoryNames = await loadCategoryNames(input.businessId);

  const summaries: string[] = [];

  for (let index = 0; index < input.pages.length; index += BATCH_SIZE) {
    const batch = input.pages.slice(index, index + BATCH_SIZE);
    summaries.push(await summarizePageBatch(batch, input.siteUrl, index / BATCH_SIZE));
  }

  const corpus = summaries.join("\n\n---\n\n").slice(0, 48_000);

  const categoryPlan = await generateClaudeKnowledgeJson({
    maxTokens: 1024,
    prompt: [
      "Propose 3-5 knowledge base category names for this business website.",
      "Prefer reusing existing category names when they fit.",
      `Existing categories: ${categoryNames.join(", ") || "none yet"}`,
      "Return ONLY JSON: {\"categories\":[\"Name\",...]}",
      "",
      corpus.slice(0, 12_000),
    ].join("\n"),
  });

  let plannedCategories = categoryNames.slice(0, 5);

  if (categoryPlan.success) {
    try {
      const parsed = JSON.parse(
        categoryPlan.text.replace(/^```json\s*/i, "").replace(/\s*```$/i, ""),
      ) as { categories?: string[] };

      if (Array.isArray(parsed.categories) && parsed.categories.length > 0) {
        plannedCategories = parsed.categories
          .map((name) => String(name).trim())
          .filter(Boolean)
          .slice(0, 5);
      }
    } catch {
      // keep defaults
    }
  }

  const seedCompact = input.seedEntries.slice(0, 120).map((entry) => ({
    title: entry.title,
    content: entry.content.slice(0, 400),
    category: entry.category,
    sourceUrl: entry.sourceUrl,
  }));

  const organized = await generateClaudeKnowledgeJson({
    maxTokens: 8192,
    systemInstruction:
      "You are a knowledge-base architect for customer-support AI. Never invent facts. Only reorganize provided content.",
    prompt: [
      `Website: ${input.siteUrl}`,
      `Use these categories (create entries under them): ${plannedCategories.join(" | ")}`,
      "Return ONLY JSON:",
      '{"entries":[{"title":"...","content":"...","category":"...","sourcePageUrl":"https://...","price":"optional"}]}',
      "",
      "Rules:",
      "- 3-80 high-quality entries, no duplicates, no nav/cookie fluff.",
      "- Each entry must cite a real sourcePageUrl from the site when possible.",
      "- Match category to the closest planned category name.",
      "- Merge seed candidates when they repeat the same fact.",
      "",
      "Site corpus:",
      corpus,
      "",
      "Seed candidates:",
      JSON.stringify(seedCompact),
    ].join("\n"),
  });

  if (!organized.success) {
    return input.seedEntries;
  }

  try {
    const parsed = parseClaudeEntriesPayload(organized.text, input.siteUrl);

    if (parsed.length === 0) {
      return input.seedEntries;
    }

    return parsed.slice(0, MAX_TOTAL_ENTRIES);
  } catch {
    return input.seedEntries;
  }
}
