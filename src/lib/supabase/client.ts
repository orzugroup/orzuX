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

export function createClient() {
  return createBrowserClient<Database>(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      cookieOptions: {
        path: "/",
        sameSite: "lax",
        // Browser cannot set HttpOnly; Secure is set by the browser on HTTPS.
        secure:
          typeof window !== "undefined"
            ? window.location.protocol === "https:"
            : true,
      },
    },
  );
}

/** Safe for client hooks — returns null when public Supabase env is not configured. */
export function createClientIfConfigured() {
  const config = getBrowserSupabaseConfig();

  if (!config) {
    return null;
  }

  if (!browserClient) {
    browserClient = createBrowserClient<Database>(config.url, config.anonKey, {
      cookieOptions: {
        path: "/",
        sameSite: "lax",
        secure:
          typeof window !== "undefined"
            ? window.location.protocol === "https:"
            : true,
      },
    });
  }

  return browserClient;
}
