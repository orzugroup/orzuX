import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv } from "@/lib/env";
import type { Database } from "@/types/database.types";
import { formatBusinessProfileForAi } from "@/utils/business";

export async function fetchBusinessProfileAiContext(
  businessId: string,
  admin?: SupabaseClient<Database>,
): Promise<string | null> {
  if (!hasSupabaseEnv()) {
    return null;
  }

  const client = admin ?? createAdminClient();
  const { data, error } = await client
    .from("businesses")
    .select(
      "business_name, business_description, business_sector, business_sector_custom, business_type, business_type_custom, email, phone, address, website, employee_count",
    )
    .eq("id", businessId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const formatted = formatBusinessProfileForAi(data);
  return formatted.trim() || null;
}

/** Plain-text block for LLM prompts when the knowledge base has no matches yet. */
export async function buildBusinessProfileKnowledgeFallback(
  businessId: string,
  admin?: SupabaseClient<Database>,
): Promise<string | undefined> {
  const profile = await fetchBusinessProfileAiContext(businessId, admin);
  if (!profile) {
    return undefined;
  }

  return [
    "Business profile from onboarding (use when knowledge base is empty or has no relevant entries):",
    profile,
  ].join("\n");
}
