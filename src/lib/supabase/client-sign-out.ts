"use client";

import { createClientIfConfigured } from "@/lib/supabase/client";
import { teardownSupabaseRealtime } from "@/lib/supabase/realtime-auth";

/** Clear in-memory access token and disconnect Realtime before server sign-out. */
export function prepareBrowserSignOut(): void {
  teardownSupabaseRealtime(createClientIfConfigured());
}
