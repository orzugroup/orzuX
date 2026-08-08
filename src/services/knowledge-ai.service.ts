import "server-only";

import {
  KNOWLEDGE_CATEGORIES,
  resolveKnowledgeCategory,
} from "@/features/knowledge-base/categories";
import {
  resolveBusinessSectorLabel,
  resolveBusinessTypeLabel,
} from "@/features/business/sectors";
import type { Business } from "@/types/database.types";
import type { KnowledgeEntryInput } from "@/types/knowledge.types";
import { knowledgeEntrySchema } from "@/types/knowledge.types";
import { generateTextWithFallback } from "@/services/llm.service";

const MAX_GENERATED_ENTRIES = 40;
const MAX_IMPORT_ENTRIES = 50;

function cleanJsonPayload(raw: string): string {
  return raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function buildBusinessContext(business: Business): string {
  const sectorLabel = resolveBusinessSectorLabel(
    business.business_sector,
    business.business_sector_custom,
  );
  const typeLabel = resolveBusinessTypeLabel(
    business.business_type,
    business.business_type_custom,
  );

  return [
    business.business_name ? `Business name: ${business.business_name}` : null,
    sectorLabel ? `Industry / sector: ${sectorLabel}` : null,
    typeLabel ? `Business type: ${typeLabel}` : null,
    business.business_description
      ? `Description: ${business.business_description}`
      : null,
    business.phone ? `Phone: ${business.phone}` : null,
    business.email ? `Email: ${business.email}` : null,
    business.address ? `Address: ${business.address}` : null,
    business.website ? `Website: ${business.website}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function parseKnowledgeEntriesPayload(raw: string): KnowledgeEntryInput[] {
  const parsed = JSON.parse(cleanJsonPayload(raw)) as {
    entries?: Array<{
      title?: string;
      content?: string;
      category?: string;
    }>;
  };

  if (!Array.isArray(parsed.entries)) {
    return [];
  }

  const validated: KnowledgeEntryInput[] = [];

  for (const entry of parsed.entries.slice(0, MAX_IMPORT_ENTRIES)) {
    const candidate = {
      title: entry.title?.trim() ?? "",
      content: entry.content?.trim() ?? "",
      category: resolveKnowledgeCategory(entry.category),
    };

    const result = knowledgeEntrySchema.safeParse(candidate);

    if (result.success) {
      validated.push(result.data);
    }
  }

  return validated;
}

function knowledgeExtractionPrompt(input: {
  contextLabel: string;
  contextBody: string;
  extraRules?: string[];
}): string {
  return [
    "You build a structured AI knowledge base for customer support.",
    "Return ONLY valid JSON (no markdown) in this shape:",
    `{"entries":[{"title":"short title","content":"factual details","category":"${KNOWLEDGE_CATEGORIES.join("|")}"}]}`,
    "Rules:",
    `- Up to ${MAX_GENERATED_ENTRIES} entries.`,
    "- Split facts by category: services, pricing, address, contact, FAQ, hours, policies, additional.",
    "- Each entry must be self-contained and useful for AI replies.",
    "- Use clear titles. Content must be factual and specific.",
    `- category must be one of: ${KNOWLEDGE_CATEGORIES.join(", ")}.`,
    ...(input.extraRules ?? []),
    "",
    input.contextLabel,
    input.contextBody,
  ].join("\n");
}

export async function generateKnowledgeEntriesFromBusiness(input: {
  businessId: string;
  business: Business;
  hints?: string;
}): Promise<
  | { success: true; entries: KnowledgeEntryInput[] }
  | { success: false; message: string }
> {
  const businessContext = buildBusinessContext(input.business);

  if (!businessContext.trim()) {
    return {
      success: false,
      message:
        "Fill in your business profile (name, description, contacts) before generating.",
    };
  }

  const result = await generateTextWithFallback({
    businessId: input.businessId,
    callType: "other",
    preferredProvider: "gemini",
    systemInstruction:
      "You create structured business knowledge bases for AI assistants. Reply with valid JSON only.",
    prompt: knowledgeExtractionPrompt({
      contextLabel: "Business profile:",
      contextBody: businessContext,
      extraRules: input.hints?.trim()
        ? [`Additional owner instructions: ${input.hints.trim()}`]
        : [
            "Infer reasonable FAQ and service details only when strongly implied by the profile.",
            "Do not invent prices unless mentioned.",
          ],
    }),
  });

  if (!result.success) {
    return {
      success: false,
      message: result.error.message ?? "Unable to generate knowledge entries.",
    };
  }

  const entries = parseKnowledgeEntriesPayload(result.data.text);

  if (entries.length === 0) {
    return {
      success: false,
      message: "AI did not return valid knowledge entries. Try again or add more business details.",
    };
  }

  return { success: true, entries };
}

export async function parseKnowledgeEntriesFromText(input: {
  businessId: string;
  text: string;
  business?: Business | null;
}): Promise<
  | { success: true; entries: KnowledgeEntryInput[] }
  | { success: false; message: string }
> {
  const trimmed = input.text.trim();

  if (trimmed.length < 20) {
    return {
      success: false,
      message: "Paste at least 20 characters of business information to import.",
    };
  }

  const businessContext = input.business
    ? buildBusinessContext(input.business)
    : "";

  const result = await generateTextWithFallback({
    businessId: input.businessId,
    callType: "other",
    preferredProvider: "gemini",
    systemInstruction:
      "You convert unstructured business text into categorized knowledge base entries. Reply with valid JSON only.",
    prompt: knowledgeExtractionPrompt({
      contextLabel: "Source text to convert:",
      contextBody: trimmed.slice(0, 12000),
      extraRules: [
        "Extract every distinct fact from the source text.",
        "Do not invent data that is not present in the source.",
        businessContext ? `Business profile for context:\n${businessContext}` : "",
      ].filter(Boolean),
    }),
  });

  if (!result.success) {
    return {
      success: false,
      message: result.error.message ?? "Unable to parse imported text.",
    };
  }

  const entries = parseKnowledgeEntriesPayload(result.data.text);

  if (entries.length === 0) {
    return {
      success: false,
      message: "Could not extract structured entries from this text.",
    };
  }

  return { success: true, entries };
}
