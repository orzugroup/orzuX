import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/env";
import {
  getSupabaseAuthCookieOptions,
  mergeAuthCookieOptions,
} from "@/lib/supabase/auth-cookie-options";
import type { Database } from "@/types/database.types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      cookieOptions: getSupabaseAuthCookieOptions(),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, mergeAuthCookieOptions(options));
            });
          } catch {
            // Server Components cannot write cookies; middleware handles refresh.
          }
        },
      },
    },
  );
}
