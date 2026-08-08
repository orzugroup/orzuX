import { NextResponse, type NextRequest } from "next/server";

import { APP_ROUTES, AUTH_ROUTES } from "@/constants/routes";
import { VERIFICATION_MESSAGES } from "@/features/auth/constants";
import { createClient } from "@/lib/supabase/server";
import {
  hasOnboardingDripAnchor,
  triggerGoogleWelcomeEmail,
} from "@/services/onboarding-drip.service";
import { handlePostLoginSecurityNotify } from "@/services/auth-security-email.service";
import { authCallbackQuerySchema } from "@/types/auth.types";
import {
  getSafeRedirectPath,
  shouldUseVerifySuccessRedirect,
} from "@/utils/auth";
import { getLoginContextFromRequest } from "@/utils/request-login-context";
import { resolveAuthenticatedLandingPathForUser } from "@/utils/post-auth-redirect";

const NEW_USER_WINDOW_MS = 10 * 60 * 1000;

function isGoogleProvider(user: {
  app_metadata?: Record<string, unknown>;
  identities?: Array<{ provider?: string }>;
}): boolean {
  const provider = user.app_metadata?.provider;

  if (provider === "google") {
    return true;
  }

  return user.identities?.some((identity) => identity.provider === "google") ?? false;
}

function isRecentlyCreated(createdAt: string | undefined): boolean {
  if (!createdAt) {
    return false;
  }

  return Date.now() - new Date(createdAt).getTime() <= NEW_USER_WINDOW_MS;
}

function extractFirstName(user: {
  user_metadata?: Record<string, unknown>;
}): string | null {
  const metadata = user.user_metadata ?? {};
  const fullName =
    (typeof metadata.full_name === "string" && metadata.full_name) ||
    (typeof metadata.name === "string" && metadata.name) ||
    null;

  if (!fullName) {
    return null;
  }

  return fullName.trim().split(/\s+/)[0] ?? null;
}

async function maybeSendGoogleWelcomeEmail(user: {
  id: string;
  email?: string | null;
  created_at?: string;
  app_metadata?: Record<string, unknown>;
  identities?: Array<{ provider?: string }>;
  user_metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!user.email || !isGoogleProvider(user) || !isRecentlyCreated(user.created_at)) {
    return;
  }

  const alreadyWelcomed = await hasOnboardingDripAnchor(user.id);

  if (alreadyWelcomed) {
    return;
  }

  void triggerGoogleWelcomeEmail({
    userId: user.id,
    email: user.email,
    firstName: extractFirstName(user),
  });
}

export async function GET(request: NextRequest) {
  const query = authCallbackQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  if (!query.success) {
    return NextResponse.redirect(
      new URL(AUTH_ROUTES.authCodeError, request.url),
    );
  }

  const {
    code,
    next,
    error,
    error_description: errorDescription,
    token_hash: tokenHash,
    type: otpType,
  } = query.data;

  if (error) {
    const errorUrl = new URL(AUTH_ROUTES.authCodeError, request.url);
    errorUrl.searchParams.set(
      "message",
      errorDescription ?? error,
    );

    return NextResponse.redirect(errorUrl);
  }

  if (!code) {
    if (tokenHash && otpType) {
      const confirmUrl = new URL(AUTH_ROUTES.confirm, request.url);
      confirmUrl.searchParams.set("token_hash", tokenHash);
      confirmUrl.searchParams.set("type", otpType);
      if (next) {
        confirmUrl.searchParams.set("next", next);
      }
      return NextResponse.redirect(confirmUrl);
    }

    return NextResponse.redirect(
      new URL(AUTH_ROUTES.authCodeError, request.url),
    );
  }

  const supabase = await createClient();
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    const errorUrl = new URL(AUTH_ROUTES.authCodeError, request.url);
    const message = exchangeError.message.toLowerCase().includes("expired")
      ? VERIFICATION_MESSAGES.invalidLink
      : exchangeError.message;
    errorUrl.searchParams.set("message", message);

    return NextResponse.redirect(errorUrl);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await maybeSendGoogleWelcomeEmail(user);

    if (user.email) {
      const loginContext = getLoginContextFromRequest(request);
      void handlePostLoginSecurityNotify({
        userId: user.id,
        email: user.email,
        userAgent: loginContext.userAgent,
        ipAddress: loginContext.ipAddress,
      });
    }
  }

  const redirectPath = user
    ? await resolveAuthenticatedLandingPathForUser(user.id, next)
    : APP_ROUTES.dashboard;

  if (!shouldUseVerifySuccessRedirect(redirectPath)) {
    return NextResponse.redirect(new URL(redirectPath, request.url));
  }

  const successUrl = new URL(AUTH_ROUTES.verifySuccess, request.url);
  successUrl.searchParams.set("next", getSafeRedirectPath(next));

  return NextResponse.redirect(successUrl);
}
