import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import { APP_ROUTES, AUTH_ROUTES } from "@/constants/routes";
import { GOOGLE_SIGN_IN_MESSAGES } from "@/features/auth/constants";
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
  hasSupabaseEnv,
} from "@/lib/env";
import {
  getSupabaseAuthCookieOptions,
  mergeAuthCookieOptions,
} from "@/lib/supabase/auth-cookie-options";
import type { Database } from "@/types/database.types";
import { getSafeRedirectPath } from "@/utils/auth-redirect";

type PendingCookie = {
  name: string;
  value: string;
  options: CookieOptions;
};

/**
 * Start Google OAuth in a Route Handler (not a Server Action).
 * PKCE code_verifier must be Set-Cookie on the same response as the
 * redirect to Google — otherwise the first login fails with
 * "PKCE code verifier not found in storage".
 */
export async function GET(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    const errorUrl = new URL(AUTH_ROUTES.authCodeError, request.url);
    errorUrl.searchParams.set(
      "message",
      "Authentication services are not configured.",
    );
    return NextResponse.redirect(errorUrl);
  }

  const nextPath = getSafeRedirectPath(
    request.nextUrl.searchParams.get("next") ?? APP_ROUTES.dashboard,
  );
  // Keep PKCE cookies and OAuth callback on the same host the user started from
  // (apex vs www). Using NEXT_PUBLIC_APP_URL alone breaks first Google login.
  const callbackUrl = new URL(AUTH_ROUTES.callback, request.nextUrl.origin);
  callbackUrl.searchParams.set("next", nextPath);
  const redirectTo = callbackUrl.toString();
  const pendingCookies: PendingCookie[] = [];

  const supabase = createServerClient<Database>(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      cookieOptions: getSupabaseAuthCookieOptions(),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            pendingCookies.push({
              name,
              value,
              options: mergeAuthCookieOptions(options),
            });
          });
        },
      },
    },
  );

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });

  if (error || !data.url) {
    const errorUrl = new URL(AUTH_ROUTES.authCodeError, request.url);
    errorUrl.searchParams.set(
      "message",
      error?.message || GOOGLE_SIGN_IN_MESSAGES.missingRedirectUrl,
    );
    return NextResponse.redirect(errorUrl);
  }

  const response = NextResponse.redirect(data.url, { status: 302 });
  for (const cookie of pendingCookies) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}
