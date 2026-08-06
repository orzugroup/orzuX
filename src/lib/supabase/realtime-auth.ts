import type { SupabaseClient } from "@supabase/supabase-js";

import {
  clearAccessTokenCache,
  fetchAccessToken,
} from "@/lib/supabase/access-token-client";
import type { Database } from "@/types/database.types";

let prepareGeneration = 0;
let preparePromise: Promise<boolean> | null = null;
let appliedAuthToken: string | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function clearRefreshTimer(): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

function scheduleAccessTokenRefresh(
  supabase: SupabaseClient<Database>,
  expiresAtMs: number,
): void {
  clearRefreshTimer();

  const delayMs = Math.max(5_000, expiresAtMs - Date.now() - 60_000);

  refreshTimer = setTimeout(() => {
    clearAccessTokenCache();
    invalidateSupabaseRealtime();
    void prepareSupabaseRealtime(supabase);
  }, delayMs);
}

export async function ensureSupabaseRealtimeAuth(
  supabase: SupabaseClient<Database>,
): Promise<boolean> {
  const payload = await fetchAccessToken();

  if (!payload?.accessToken) {
    return false;
  }

  await supabase.realtime.setAuth(payload.accessToken);
  scheduleAccessTokenRefresh(supabase, payload.expiresAtMs);
  return true;
}

/**
 * Sets JWT on the Realtime socket and reconnects when the token changes.
 * Access token comes from the server (HttpOnly session); never from document.cookie.
 */
export async function prepareSupabaseRealtime(
  supabase: SupabaseClient<Database>,
): Promise<boolean> {
  const generation = ++prepareGeneration;
  const payload = await fetchAccessToken();

  if (!payload?.accessToken || generation !== prepareGeneration) {
    return false;
  }

  const token = payload.accessToken;

  if (token === appliedAuthToken) {
    scheduleAccessTokenRefresh(supabase, payload.expiresAtMs);
    return true;
  }

  await supabase.realtime.setAuth(token);
  supabase.realtime.disconnect();
  supabase.realtime.connect();
  appliedAuthToken = token;
  scheduleAccessTokenRefresh(supabase, payload.expiresAtMs);

  return true;
}

export function waitForSupabaseRealtime(
  supabase: SupabaseClient<Database>,
): Promise<boolean> {
  if (!preparePromise) {
    preparePromise = prepareSupabaseRealtime(supabase).finally(() => {
      preparePromise = null;
    });
  }

  return preparePromise;
}

export function invalidateSupabaseRealtime(): void {
  prepareGeneration += 1;
  preparePromise = null;
  appliedAuthToken = null;
  clearRefreshTimer();
}

/**
 * Disconnect Realtime and drop in-memory access token (call before logout).
 */
export function teardownSupabaseRealtime(
  supabase: SupabaseClient<Database> | null,
): void {
  invalidateSupabaseRealtime();
  clearAccessTokenCache();

  if (!supabase) {
    return;
  }

  try {
    supabase.realtime.setAuth("");
    supabase.realtime.disconnect();
  } catch {
    // Best-effort cleanup before sign-out redirect.
  }
}

/**
 * Polling refresh when the tab is visible — browser has no cookie session events.
 */
export function bindSupabaseRealtimeAuthRefresh(
  supabase: SupabaseClient<Database>,
): () => void {
  const onVisible = () => {
    if (document.visibilityState === "visible") {
      void prepareSupabaseRealtime(supabase);
    }
  };

  document.addEventListener("visibilitychange", onVisible);

  return () => {
    document.removeEventListener("visibilitychange", onVisible);
    clearRefreshTimer();
  };
}
