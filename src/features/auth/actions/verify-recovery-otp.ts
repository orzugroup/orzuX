"use server";

import {
  assertOtpVerifyAllowed,
  clearOtpVerifyFailures,
  formatAuthGuardMessage,
  recordOtpVerifyFailure,
} from "@/lib/security/auth-brute-force";
import { verifyRecoveryOtpCode } from "@/services/auth.service";
import { PASSWORD_RESET_MESSAGES } from "@/features/auth/constants";
import type {
  PasswordResetRequestResult,
  VerifyRecoveryOtpInput,
} from "@/types/auth.types";
import { verifyRecoveryOtpSchema } from "@/types/auth.types";

export async function verifyRecoveryOtpAction(
  input: VerifyRecoveryOtpInput,
): Promise<PasswordResetRequestResult> {
  const parsed = verifyRecoveryOtpSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid input.",
      },
    };
  }

  const guard = await assertOtpVerifyAllowed(parsed.data.email, "recovery");

  if (!guard.allowed) {
    return {
      success: false,
      error: {
        code: "INVALID_SESSION",
        message: formatAuthGuardMessage(guard),
      },
    };
  }

  const result = await verifyRecoveryOtpCode(parsed.data);

  if (!result.success && result.error?.code === "INVALID_SESSION") {
    await recordOtpVerifyFailure(parsed.data.email, "recovery");
    return {
      ...result,
      error: {
        ...result.error,
        message: result.error.message ?? PASSWORD_RESET_MESSAGES.invalidSession,
      },
    };
  }

  if (result.success) {
    await clearOtpVerifyFailures(parsed.data.email, "recovery");
  }

  return result;
}
