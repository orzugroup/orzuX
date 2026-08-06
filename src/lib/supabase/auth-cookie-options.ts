import type { CookieOptions } from "@supabase/ssr";

/**
 * Auth cookie defaults for CASA / production HTTPS.
 *
 * - `secure: true` on Vercel/production so session cookies are HTTPS-only (2.3.1).
 * - `httpOnly` stays false: @supabase/ssr browser client + Realtime read the
 *   session from document.cookie; HttpOnly would break dashboard Realtime/RLS
 *   client queries unless all auth is moved server-side.
 */
export function isSecureAuthCookieEnvironment(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL === "1" ||
    process.env.VERCEL_ENV === "production"
  );
}

export function getSupabaseAuthCookieOptions(): CookieOptions {
  return {
    path: "/",
    sameSite: "lax",
    secure: isSecureAuthCookieEnvironment(),
    httpOnly: false,
  };
}

/** Merge Supabase-provided options with enforced production Secure flag. */
export function mergeAuthCookieOptions(
  options: CookieOptions | undefined,
): CookieOptions {
  const defaults = getSupabaseAuthCookieOptions();
  const merged: CookieOptions = {
    ...defaults,
    ...options,
    path: options?.path ?? defaults.path,
    sameSite: options?.sameSite ?? defaults.sameSite,
  };

  if (isSecureAuthCookieEnvironment()) {
    merged.secure = true;
  }

  return merged;
}
