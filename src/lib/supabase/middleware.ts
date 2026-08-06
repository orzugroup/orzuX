import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { APP_ROUTES, AUTH_ROUTES, DASHBOARD_ROUTES } from "@/constants/routes";
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
  hasSupabaseEnv,
} from "@/lib/env.edge";
import {
  getSupabaseAuthCookieOptions,
  mergeAuthCookieOptions,
} from "@/lib/supabase/auth-cookie-options";
import type { Database } from "@/types/database.types";
import { isAuthEntryRoute, isProtectedRoute } from "@/utils/auth-routes";

export async function updateSession(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

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
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          supabaseResponse = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(
              name,
              value,
              mergeAuthCookieOptions(options),
            );
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && isProtectedRoute(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = AUTH_ROUTES.login;
    redirectUrl.searchParams.set("next", pathname);

    return NextResponse.redirect(redirectUrl);
  }

  if (user && isAuthEntryRoute(pathname)) {
    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = business
      ? APP_ROUTES.dashboard
      : DASHBOARD_ROUTES.onboarding;
    redirectUrl.search = "";

    return NextResponse.redirect(redirectUrl);
  }

  if (
    user &&
    pathname.startsWith("/dashboard") &&
    pathname !== DASHBOARD_ROUTES.onboarding &&
    pathname !== DASHBOARD_ROUTES.suspended
  ) {
    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (business?.id) {
      const { data: controls } = await supabase
        .from("platform_business_controls")
        .select("account_status")
        .eq("business_id", business.id)
        .maybeSingle();

      if (controls?.account_status === "suspended") {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = DASHBOARD_ROUTES.suspended;
        redirectUrl.search = "";
        return NextResponse.redirect(redirectUrl);
      }
    }
  }

  return supabaseResponse;
}
