import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

export {
  buildCrmActionIdempotencyKey,
  buildExecutorPlanIdempotencyKey,
} from "@/lib/crm/executor-idempotency-keys";

type MessagingDbClient = SupabaseClient<Database>;

export async function hasCrmIdempotencyKey(
  admin: MessagingDbClient,
  businessId: string,
  idempotencyKey: string,
): Promise<boolean> {
  const { data } = await admin
    .from("agent_crm_idempotency")
    .select("id")
    .eq("business_id", businessId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  return Boolean(data);
}

export async function recordCrmIdempotencyKey(
  admin: MessagingDbClient,
  input: {
    businessId: string;
    idempotencyKey: string;
    actionType: string;
  },
): Promise<void> {
  const { error } = await admin.from("agent_crm_idempotency").insert({
    business_id: input.businessId,
    idempotency_key: input.idempotencyKey,
    action_type: input.actionType,
  });

  if (error && error.code !== "23505") {
    throw error;
  }
}

export async function pruneOldCrmIdempotencyKeys(
  businessId: string,
  olderThanDays = 30,
): Promise<void> {
  const admin = createAdminClient();
  const cutoff = new Date(
    Date.now() - olderThanDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  await admin
    .from("agent_crm_idempotency")
    .delete()
    .eq("business_id", businessId)
    .lt("created_at", cutoff);
}
