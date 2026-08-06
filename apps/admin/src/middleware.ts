import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  ADMIN_DEFAULT_PATH,
  ADMIN_LOGIN_PATH,
  MFA_ENROLL_PATH,
  MFA_VERIFY_PATH,
  resolveAdminMfaGate,
} from "@/lib/mfa";

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const secureCookie =
    process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      secure: secureCookie,
      httpOnly: true,
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, {
            ...options,
            path: options?.path ?? "/",
            sameSite: options?.sameSite ?? "lax",
            httpOnly: true,
            ...(secureCookie ? { secure: true } : {}),
          });
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLogin = pathname === ADMIN_LOGIN_PATH;
  const isMfaEnroll =
    pathname === MFA_ENROLL_PATH || pathname.startsWith(`${MFA_ENROLL_PATH}/`);
  const isMfaVerify =
    pathname === MFA_VERIFY_PATH || pathname.startsWith(`${MFA_VERIFY_PATH}/`);

  if (!user) {
    if (isLogin) {
      return response;
    }

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = ADMIN_LOGIN_PATH;
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  const { data: adminRow } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!adminRow) {
    await supabase.auth.signOut();

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = ADMIN_LOGIN_PATH;
    redirectUrl.searchParams.set("error", "forbidden");
    return NextResponse.redirect(redirectUrl);
  }

  const [{ data: aal }, { data: factors }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);

  const verifiedTotpCount = (factors?.totp ?? []).filter(
    (factor) => factor.status === "verified",
  ).length;

  const gate = resolveAdminMfaGate({
    currentLevel: aal?.currentLevel,
    verifiedTotpCount,
  });

  if (gate.kind === "enroll" && !isMfaEnroll) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = MFA_ENROLL_PATH;
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (gate.kind === "verify" && !isMfaVerify) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = MFA_VERIFY_PATH;
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (
    gate.kind === "allow" &&
    (isLogin || isMfaEnroll || isMfaVerify || pathname === "/")
  ) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = ADMIN_DEFAULT_PATH;
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (gate.kind === "enroll" && isMfaEnroll) {
    return response;
  }

  if (gate.kind === "verify" && isMfaVerify) {
    return response;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|manifest.webmanifest|sw.js|icon-.*).*)",
  ],
};
