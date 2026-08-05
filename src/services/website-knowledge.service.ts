import "server-only";

import { revalidatePath } from "next/cache";

import { scheduleAfterResponse } from "@/lib/queue/schedule-deferred";

import { APP_ROUTES, DASHBOARD_ROUTES } from "@/constants/routes";
import { WEBSITE_KNOWLEDGE_MESSAGES } from "@/features/website-knowledge/constants";
import { hasGeminiEnv, hasSupabaseEnv } from "@/lib/env";
import { crawlWebsiteWithFallback } from "@/lib/website-knowledge/crawler";
import { hasClaudeEnv } from "@/services/claude.service";
import { extractKnowledgeEntriesFromPages } from "@/lib/website-knowledge/extract-entries";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/services/auth.service";
import { getPrimaryBusiness } from "@/services/business.service";
import type { WebsiteKnowledgeSync } from "@/types/database.types";
import type {
  SaveWebsiteKnowledgeResult,
  SyncWebsiteKnowledgeResult,
  WebsiteKnowledgeSetupInput,
  WebsiteKnowledgeSyncData,
} from "@/types/website-knowledge.types";
import { websiteKnowledgeSetupSchema } from "@/types/website-knowledge.types";
import {
  computeNextSyncAt,
  mapWebsiteKnowledgeSync,
  normalizeWebsiteUrl,
} from "@/utils/website-knowledge";

function revalidateWebsiteKnowledgePaths(): void {
  revalidatePath(DASHBOARD_ROUTES.knowledgeBase);
  revalidatePath(DASHBOARD_ROUTES.aiAssistantKnowledge);
  revalidatePath(DASHBOARD_ROUTES.aiAssistantKnowledgeWebsite);
  revalidatePath(DASHBOARD_ROUTES.integrations);
  revalidatePath(`${DASHBOARD_ROUTES.integrations}/website_knowledge`);
  revalidatePath(APP_ROUTES.dashboard);
}

function hasWebsiteKnowledgeAiEnv(): boolean {
  return hasGeminiEnv() || hasClaudeEnv();
}

async function getOwnedBusinessId(): Promise<string | null> {
  const user = await requireUser();
  const business = await getPrimaryBusiness(user.id);
  return business?.id ?? null;
}

export async function getWebsiteKnowledgeSync(
  businessId: string,
): Promise<WebsiteKnowledgeSyncData | null> {
  if (!hasSupabaseEnv()) {
    return null;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("website_knowledge_syncs")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  return data ? mapWebsiteKnowledgeSync(data) : null;
}

export async function saveWebsiteKnowledgeSetup(
  input: WebsiteKnowledgeSetupInput,
): Promise<SaveWebsiteKnowledgeResult> {
  if (!hasSupabaseEnv()) {
    return {
      success: false,
      error: { code: "MISSING_CONFIG", message: WEBSITE_KNOWLEDGE_MESSAGES.notConfigured },
    };
  }

  if (!hasWebsiteKnowledgeAiEnv()) {
    return {
      success: false,
      error: { code: "MISSING_CONFIG", message: WEBSITE_KNOWLEDGE_MESSAGES.geminiRequired },
    };
  }

  const parsed = websiteKnowledgeSetupSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? WEBSITE_KNOWLEDGE_MESSAGES.genericError,
      },
    };
  }

  const businessId = await getOwnedBusinessId();

  if (!businessId) {
    return {
      success: false,
      error: { code: "NO_BUSINESS", message: WEBSITE_KNOWLEDGE_MESSAGES.noBusinessDescription },
    };
  }

  const siteUrl = normalizeWebsiteUrl(parsed.data.siteUrl);
  const autoSyncEnabled = parsed.data.autoSyncEnabled ?? true;
  const syncIntervalHours = parsed.data.syncIntervalHours ?? 168;
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("website_knowledge_syncs")
    .select("id")
    .eq("business_id", businessId)
    .maybeSingle();

  const row = {
    business_id: businessId,
    site_url: siteUrl,
    auto_sync_enabled: autoSyncEnabled,
    sync_interval_hours: syncIntervalHours,
    sync_status: "idle" as const,
    next_sync_at: computeNextSyncAt(0),
  };

  if (existing) {
    const { data: updated, error } = await supabase
      .from("website_knowledge_syncs")
      .update({
        site_url: siteUrl,
        auto_sync_enabled: autoSyncEnabled,
        sync_interval_hours: syncIntervalHours,
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error || !updated) {
      return {
        success: false,
        error: { code: "DB_ERROR", message: WEBSITE_KNOWLEDGE_MESSAGES.genericError },
      };
    }

    revalidateWebsiteKnowledgePaths();
    return { success: true, data: mapWebsiteKnowledgeSync(updated) };
  }

  const { data: created, error } = await supabase
    .from("website_knowledge_syncs")
    .insert(row)
    .select("*")
    .single();

  if (error || !created) {
    return {
      success: false,
      error: { code: "DB_ERROR", message: WEBSITE_KNOWLEDGE_MESSAGES.genericError },
    };
  }

  revalidateWebsiteKnowledgePaths();
  return { success: true, data: mapWebsiteKnowledgeSync(created) };
}

async function replaceWebsiteSyncKnowledge(
  businessId: string,
  entries: Array<{
    title: string;
    content: string;
    category: string;
    sourceUrl: string;
    metadata?: Record<string, string | undefined>;
  }>,
): Promise<number> {
  const admin = createAdminClient();
  const { ensureKnowledgeCategoryForName } =
    await import("@/services/knowledge-categories.service");
  const { inferLayoutKindFromName } =
    await import("@/types/knowledge-category.types");

  await admin
    .from("knowledge_base")
    .delete()
    .eq("business_id", businessId)
    .eq("source", "website_sync");

  if (entries.length === 0) {
    return 0;
  }

  const categoryNames = [...new Set(entries.map((entry) => entry.category))];
  const resolvedNames = new Map<string, string>();

  for (const name of categoryNames) {
    const card = await ensureKnowledgeCategoryForName(businessId, name, {
      layoutKind: inferLayoutKindFromName(name),
    });
    resolvedNames.set(name, card.name);
  }

  const { data, error } = await admin
    .from("knowledge_base")
    .insert(
      entries.map((entry) => ({
        business_id: businessId,
        title: entry.title,
        content: entry.content,
        category: resolvedNames.get(entry.category) ?? entry.category,
        source: "website_sync",
        source_url: entry.sourceUrl,
        metadata: entry.metadata ?? {},
      })),
    )
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  return data?.length ?? 0;
}

export async function runWebsiteKnowledgeSyncForRow(
  syncRow: WebsiteKnowledgeSync,
  options?: { skipStatusUpdate?: boolean },
): Promise<SyncWebsiteKnowledgeResult> {
  if (!hasSupabaseEnv() || !hasWebsiteKnowledgeAiEnv()) {
    return {
      success: false,
      error: { code: "MISSING_CONFIG", message: WEBSITE_KNOWLEDGE_MESSAGES.notConfigured },
    };
  }

  const admin = createAdminClient();

  if (!options?.skipStatusUpdate) {
    await admin
      .from("website_knowledge_syncs")
      .update({
        sync_status: "syncing",
        last_sync_error: null,
      })
      .eq("id", syncRow.id);
  }

  try {
    const { pages, resolvedStartUrl } = await crawlWebsiteWithFallback(
      syncRow.site_url,
    );

    if (pages.length === 0) {
      throw new Error(WEBSITE_KNOWLEDGE_MESSAGES.noPagesFound);
    }

    if (resolvedStartUrl !== syncRow.site_url) {
      await admin
        .from("website_knowledge_syncs")
        .update({ site_url: resolvedStartUrl })
        .eq("id", syncRow.id);
    }

    const extracted = await extractKnowledgeEntriesFromPages(
      pages,
      resolvedStartUrl,
      syncRow.business_id,
    );

    if (extracted.length === 0) {
      throw new Error(WEBSITE_KNOWLEDGE_MESSAGES.noEntriesExtracted);
    }

    const entriesSynced = await replaceWebsiteSyncKnowledge(
      syncRow.business_id,
      extracted,
    );

    const now = new Date().toISOString();
    const nextSyncAt = syncRow.auto_sync_enabled
      ? computeNextSyncAt(syncRow.sync_interval_hours)
      : null;

    await admin
      .from("website_knowledge_syncs")
      .update({
        sync_status: "ready",
        last_synced_at: now,
        next_sync_at: nextSyncAt,
        last_sync_error: null,
        pages_indexed: pages.length,
        entries_synced: entriesSynced,
      })
      .eq("id", syncRow.id);

    revalidateWebsiteKnowledgePaths();

    return {
      success: true,
      data: {
        pagesIndexed: pages.length,
        entriesSynced,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : WEBSITE_KNOWLEDGE_MESSAGES.genericError;

    await admin
      .from("website_knowledge_syncs")
      .update({
        sync_status: "error",
        last_sync_error: message,
      })
      .eq("id", syncRow.id);

    revalidateWebsiteKnowledgePaths();

    return {
      success: false,
      error: { code: "SYNC_FAILED", message },
    };
  }
}

export async function startWebsiteKnowledgeSyncInBackground(): Promise<
  | { success: true; data: { started: true } }
  | { success: false; error: { code: string; message: string } }
> {
  const businessId = await getOwnedBusinessId();

  if (!businessId) {
    return {
      success: false,
      error: { code: "NO_BUSINESS", message: WEBSITE_KNOWLEDGE_MESSAGES.noBusinessDescription },
    };
  }

  const supabase = await createClient();
  const { data: syncRow } = await supabase
    .from("website_knowledge_syncs")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  if (!syncRow) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: WEBSITE_KNOWLEDGE_MESSAGES.setupRequired },
    };
  }

  if (syncRow.sync_status === "syncing") {
    return {
      success: true,
      data: { started: true },
    };
  }

  const admin = createAdminClient();
  await admin
    .from("website_knowledge_syncs")
    .update({
      sync_status: "syncing",
      last_sync_error: null,
    })
    .eq("id", syncRow.id);

  revalidateWebsiteKnowledgePaths();

  const rowSnapshot = { ...syncRow };

  scheduleAfterResponse(0, async () => {
    await runWebsiteKnowledgeSyncForRow(rowSnapshot, { skipStatusUpdate: true });
  });

  return { success: true, data: { started: true } };
}

export async function syncWebsiteKnowledgeNow(): Promise<SyncWebsiteKnowledgeResult> {
  const started = await startWebsiteKnowledgeSyncInBackground();

  if (!started.success) {
    return started;
  }

  return {
    success: true,
    data: {
      pagesIndexed: 0,
      entriesSynced: 0,
      background: true,
    },
  };
}

export async function runDueWebsiteKnowledgeSyncs(): Promise<{
  processed: number;
  succeeded: number;
}> {
  if (!hasSupabaseEnv() || !hasWebsiteKnowledgeAiEnv()) {
    return { processed: 0, succeeded: 0 };
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: dueRows } = await admin
    .from("website_knowledge_syncs")
    .select("*")
    .eq("auto_sync_enabled", true)
    .neq("sync_status", "syncing")
    .or(`next_sync_at.is.null,next_sync_at.lte.${now}`)
    .limit(5);

  let succeeded = 0;

  for (const row of dueRows ?? []) {
    const result = await runWebsiteKnowledgeSyncForRow(row);

    if (result.success) {
      succeeded += 1;
    }
  }

  return { processed: dueRows?.length ?? 0, succeeded };
}

export async function disconnectWebsiteKnowledge(): Promise<{ success: boolean }> {
  const businessId = await getOwnedBusinessId();

  if (!businessId || !hasSupabaseEnv()) {
    return { success: false };
  }

  const admin = createAdminClient();

  await admin
    .from("knowledge_base")
    .delete()
    .eq("business_id", businessId)
    .eq("source", "website_sync");

  await admin.from("website_knowledge_syncs").delete().eq("business_id", businessId);

  revalidateWebsiteKnowledgePaths();
  return { success: true };
}
