import type { EmailOtpType } from "@supabase/supabase-js";

import { APP_ROUTES, AUTH_ROUTES } from "@/constants/routes";
import { getAppUrl } from "@/lib/env";

import { getSafeRedirectPath } from "./auth-redirect";

export type AdminGenerateLinkProperties = {
  action_link?: string | null;
  hashed_token?: string | null;
  verification_type?: string | null;
};

const CONFIRM_TYPES = new Set<string>([
  "signup",
  "email",
  "recovery",
  "invite",
  "magiclink",
]);

function resolveOtpType(
  verificationType: string | null | undefined,
  fallback: EmailOtpType,
): EmailOtpType {
  const normalized = verificationType?.trim().toLowerCase();
  if (normalized && CONFIRM_TYPES.has(normalized)) {
    return normalized as EmailOtpType;
  }
  return fallback;
}

/**
 * Prefer a direct /auth/confirm link (token_hash) so verification does not depend
 * on PKCE code exchange in /auth/callback (avoids "Token has expired or is invalid").
 */
export function buildVerificationLinkFromGenerateLink(
  properties: AdminGenerateLinkProperties,
  options: {
    nextPath?: string;
    fallbackType?: EmailOtpType;
  } = {},
): string | null {
  const nextPath = getSafeRedirectPath(
    options.nextPath ?? APP_ROUTES.dashboard,
  );
  const fallbackType = options.fallbackType ?? "signup";
  const hashed = properties.hashed_token?.trim();

  if (hashed) {
    const url = new URL(AUTH_ROUTES.confirm, getAppUrl());
    url.searchParams.set("token_hash", hashed);
    url.searchParams.set(
      "type",
      resolveOtpType(properties.verification_type, fallbackType),
    );
    url.searchParams.set("next", nextPath);
    return url.toString();
  }

  const actionLink = properties.action_link?.trim();
  return actionLink || null;
}

export function buildAuthConfirmRedirectUrl(nextPath?: string): string {
  const url = new URL(AUTH_ROUTES.confirm, getAppUrl());
  url.searchParams.set("next", getSafeRedirectPath(nextPath ?? APP_ROUTES.dashboard));
  return url.toString();
}
