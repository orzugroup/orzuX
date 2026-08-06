import type { CookieOptions } from "@supabase/ssr";

/**
 * Auth cookie defaults for CASA session security.
 *
 * - `secure: true` on Vercel/production (HTTPS-only).
 * - `httpOnly: true` so refresh/session cookies are not readable by JS.
 *   Browser Realtime uses a short-lived access token from GET /api/auth/access-token
 *   via realtime.setAuth — never from document.cookie.
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
    httpOnly: true,
  };
}

/** Merge Supabase-provided options with enforced Secure + HttpOnly. */
export function mergeAuthCookieOptions(
  options: CookieOptions | undefined,
): CookieOptions {
  const defaults = getSupabaseAuthCookieOptions();
  const merged: CookieOptions = {
    ...defaults,
    ...options,
    path: options?.path ?? defaults.path,
    sameSite: options?.sameSite ?? defaults.sameSite,
    httpOnly: true,
  };

  if (isSecureAuthCookieEnvironment()) {
    merged.secure = true;
  }

  return merged;
}
