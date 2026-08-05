"use server";

import {
  assertOtpVerifyAllowed,
  clearOtpVerifyFailures,
  formatAuthGuardMessage,
  recordOtpVerifyFailure,
} from "@/lib/security/auth-brute-force";
import { verifyEmailWithOtpCode } from "@/services/auth.service";
import { REGISTRATION_MESSAGES } from "@/features/auth/constants";
import type {
  VerificationResult,
  VerifyEmailOtpInput,
} from "@/types/auth.types";
import { verifyEmailOtpSchema } from "@/types/auth.types";

export async function verifyEmailOtpAction(
  input: VerifyEmailOtpInput,
): Promise<VerificationResult> {
  const parsed = verifyEmailOtpSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid input.",
      },
    };
  }

  const guard = await assertOtpVerifyAllowed(parsed.data.email, "email");

  if (!guard.allowed) {
    return {
      success: false,
      error: {
        code: "VERIFICATION_FAILED",
        message: formatAuthGuardMessage(guard),
      },
    };
  }

  const result = await verifyEmailWithOtpCode(parsed.data);

  if (!result.success && result.error?.code === "VERIFICATION_FAILED") {
    await recordOtpVerifyFailure(parsed.data.email, "email");
    return {
      ...result,
      error: {
        ...result.error,
        message: result.error.message ?? REGISTRATION_MESSAGES.otpInvalid,
      },
    };
  }

  if (result.success) {
    await clearOtpVerifyFailures(parsed.data.email, "email");
  }

  return result;
}
