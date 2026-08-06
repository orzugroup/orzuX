"use server";

import { revalidatePath } from "next/cache";

import {
  isValidTotpCode,
  normalizeTotpCode,
  type TotpFactorSummary,
} from "@/lib/mfa";
import {
  createAdminSupabaseServerClient,
  requirePlatformAdmin,
  requirePlatformAdminIdentity,
} from "@/lib/supabase/server";

export type MfaActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

export type TotpEnrollmentStart = {
  factorId: string;
  qrCode: string;
  secret: string;
  uri: string;
};

export type AdminMfaStatus = {
  currentLevel: string | null;
  nextLevel: string | null;
  verifiedTotpCount: number;
  factors: TotpFactorSummary[];
};

async function cleanupUnverifiedTotpFactors(
  supabase: Awaited<ReturnType<typeof createAdminSupabaseServerClient>>,
): Promise<void> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) {
    throw error;
  }

  const unverified = (data.all ?? []).filter(
    (factor) =>
      factor.factor_type === "totp" && factor.status === "unverified",
  );

  for (const factor of unverified) {
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }
}

function mapFactors(
  factors: {
    totp: Array<{
      id: string;
      friendly_name?: string | null;
      status: "verified" | "unverified";
      created_at: string;
    }>;
  } | null,
): TotpFactorSummary[] {
  return (factors?.totp ?? []).map((factor) => ({
    id: factor.id,
    friendlyName: factor.friendly_name ?? null,
    status: factor.status,
    createdAt: factor.created_at,
  }));
}

export async function getAdminMfaStatusAction(): Promise<
  MfaActionResult<AdminMfaStatus>
> {
  try {
    const { supabase } = await requirePlatformAdminIdentity();
    const [{ data: aal, error: aalError }, { data: factors, error: factorsError }] =
      await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ]);

    if (aalError) {
      return { success: false, error: aalError.message };
    }

    if (factorsError) {
      return { success: false, error: factorsError.message };
    }

    const mapped = mapFactors(factors);
    const verifiedTotpCount = mapped.filter(
      (factor) => factor.status === "verified",
    ).length;

    return {
      success: true,
      data: {
        currentLevel: aal?.currentLevel ?? null,
        nextLevel: aal?.nextLevel ?? null,
        verifiedTotpCount,
        factors: mapped,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load MFA status",
    };
  }
}

export async function startTotpEnrollmentAction(): Promise<
  MfaActionResult<TotpEnrollmentStart>
> {
  try {
    const { supabase } = await requirePlatformAdminIdentity();
    await cleanupUnverifiedTotpFactors(supabase);

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "OrzuX Admin Authenticator",
      issuer: "OrzuX Admin",
    });

    if (error || !data) {
      return {
        success: false,
        error: error?.message ?? "Failed to start TOTP enrollment",
      };
    }

    return {
      success: true,
      data: {
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
        uri: data.totp.uri,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to start TOTP enrollment",
    };
  }
}

export async function confirmTotpEnrollmentAction(input: {
  factorId: string;
  code: string;
}): Promise<MfaActionResult> {
  try {
    const { supabase } = await requirePlatformAdminIdentity();
    const code = normalizeTotpCode(input.code);

    if (!input.factorId.trim()) {
      return { success: false, error: "Missing MFA factor" };
    }

    if (!isValidTotpCode(code)) {
      return { success: false, error: "Enter the 6-digit authenticator code" };
    }

    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: input.factorId,
      code,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/", "layout");
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to confirm TOTP enrollment",
    };
  }
}

export async function verifyTotpChallengeAction(input: {
  code: string;
}): Promise<MfaActionResult> {
  try {
    const { supabase } = await requirePlatformAdminIdentity();
    const code = normalizeTotpCode(input.code);

    if (!isValidTotpCode(code)) {
      return { success: false, error: "Enter the 6-digit authenticator code" };
    }

    const { data: factors, error: factorsError } =
      await supabase.auth.mfa.listFactors();

    if (factorsError) {
      return { success: false, error: factorsError.message };
    }

    const factorId = factors.totp.find(
      (factor) => factor.status === "verified",
    )?.id;

    if (!factorId) {
      return {
        success: false,
        error: "No verified authenticator found. Enroll MFA first.",
      };
    }

    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/", "layout");
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to verify MFA code",
    };
  }
}

export async function unenrollTotpFactorAction(input: {
  factorId: string;
}): Promise<MfaActionResult> {
  try {
    const { supabase } = await requirePlatformAdmin();
    const { data: factors, error: factorsError } =
      await supabase.auth.mfa.listFactors();

    if (factorsError) {
      return { success: false, error: factorsError.message };
    }

    const verifiedCount = (factors.totp ?? []).filter(
      (factor) => factor.status === "verified",
    ).length;

    if (verifiedCount <= 1) {
      return {
        success: false,
        error:
          "At least one verified authenticator is required for platform admin access.",
      };
    }

    const { error } = await supabase.auth.mfa.unenroll({
      factorId: input.factorId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/security");
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to remove MFA factor",
    };
  }
}
