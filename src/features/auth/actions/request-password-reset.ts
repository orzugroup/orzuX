"use server";

import {
  assertPasswordResetRequestAllowed,
  formatAuthGuardMessage,
} from "@/lib/security/auth-brute-force";
import { requestPasswordReset } from "@/services/auth.service";
import type {
  PasswordResetRequestResult,
  RequestPasswordResetInput,
} from "@/types/auth.types";
import { requestPasswordResetSchema } from "@/types/auth.types";

export async function requestPasswordResetAction(
  input: RequestPasswordResetInput,
): Promise<PasswordResetRequestResult> {
  const parsed = requestPasswordResetSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid input.",
      },
    };
  }

  const guard = await assertPasswordResetRequestAllowed(parsed.data.email);

  if (!guard.allowed) {
    return {
      success: false,
      error: {
        code: "RESET_FAILED",
        message: formatAuthGuardMessage(guard),
      },
    };
  }

  return requestPasswordReset(parsed.data);
}
