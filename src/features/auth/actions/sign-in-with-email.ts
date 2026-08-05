"use server";

import { verifyTurnstileToken } from "@/lib/security/turnstile";
import {
  assertLoginAllowed,
  clearLoginFailures,
  formatAuthGuardMessage,
  recordLoginFailure,
} from "@/lib/security/auth-brute-force";
import { signInWithEmail } from "@/services/auth.service";
import { handlePostLoginSecurityNotify } from "@/services/auth-security-email.service";
import { LOGIN_MESSAGES } from "@/features/auth/constants";
import type { LoginResult, SignInWithEmailInput } from "@/types/auth.types";
import { signInWithEmailSchema } from "@/types/auth.types";
import { getRequestLoginContext } from "@/utils/request-login-context";

export async function signInWithEmailAction(
  input: SignInWithEmailInput,
  turnstileToken?: string,
): Promise<LoginResult> {
  const turnstile = await verifyTurnstileToken(turnstileToken);

  if (!turnstile.allowed) {
    return {
      success: false,
      error: {
        code: "LOGIN_FAILED",
        message: "Verification failed. Please try again.",
      },
    };
  }

  const parsed = signInWithEmailSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid input.",
      },
    };
  }

  const loginContext = await getRequestLoginContext();
  const guard = await assertLoginAllowed(
    parsed.data.email,
    loginContext.ipAddress,
  );

  if (!guard.allowed) {
    return {
      success: false,
      error: {
        code: guard.reason === "locked" ? "ACCOUNT_LOCKED" : "LOGIN_FAILED",
        message: formatAuthGuardMessage(guard),
      },
    };
  }

  const result = await signInWithEmail(parsed.data);

  if (!result.success) {
    if (result.error?.code === "INVALID_CREDENTIALS") {
      const failure = await recordLoginFailure(parsed.data.email);

      if (failure.locked) {
        return {
          success: false,
          error: {
            code: "ACCOUNT_LOCKED",
            message: LOGIN_MESSAGES.accountLocked,
          },
        };
      }
    }

    return result;
  }

  await clearLoginFailures(parsed.data.email);

  if (result.success) {
    const supabase = await import("@/lib/supabase/server").then((mod) =>
      mod.createClient(),
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.email) {
      void handlePostLoginSecurityNotify({
        userId: user.id,
        email: user.email,
        userAgent: loginContext.userAgent,
        ipAddress: loginContext.ipAddress,
      });
    }
  }

  return result;
}
