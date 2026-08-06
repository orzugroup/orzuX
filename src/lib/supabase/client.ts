"use client";

import { createBrowserClient } from "@supabase/ssr";

import {
  getSupabaseAnonKey,
  getSupabaseUrl,
} from "@/lib/env";
import type { Database } from "@/types/database.types";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null =
  null;

/** Client-safe public Supabase config (static env keys for Next.js inlining). */
export function getBrowserSupabaseConfig(): {
  url: string;
  anonKey: string;
} | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

/**
 * Browser client does not read/write auth cookies.
 * Session refresh tokens live in HttpOnly cookies (server/middleware only).
 * Realtime auth uses GET /api/auth/access-token + realtime.setAuth.
 */
function createBrowserSupabaseClient(url: string, anonKey: string) {
  return createBrowserClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {
        // No-op: never persist session tokens to document.cookie.
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function createClient() {
  return createBrowserSupabaseClient(getSupabaseUrl(), getSupabaseAnonKey());
}

/** Safe for client hooks — returns null when public Supabase env is not configured. */
export function createClientIfConfigured() {
  const config = getBrowserSupabaseConfig();

  if (!config) {
    return null;
  }

  if (!browserClient) {
    browserClient = createBrowserSupabaseClient(config.url, config.anonKey);
  }

  return browserClient;
}
