import { z } from "zod";

import { PASSWORD_MAX_LENGTH } from "@/features/auth/constants";
import { passwordPolicyMessage } from "@/features/auth/password-strength";

export const authCallbackQuerySchema = z.object({
  code: z.string().trim().min(1).optional(),
  token_hash: z.string().trim().min(1).optional(),
  type: z
    .enum(["signup", "email", "recovery", "invite", "magiclink"])
    .optional(),
  next: z.string().trim().optional(),
  error: z.string().trim().optional(),
  error_description: z.string().trim().optional(),
});

export const authConfirmQuerySchema = z.object({
  token_hash: z.string().trim().min(1).optional(),
  type: z.enum(["signup", "email", "recovery", "invite", "magiclink"]).optional(),
  next: z.string().trim().optional(),
  error: z.string().trim().optional(),
  error_description: z.string().trim().optional(),
});

export const resendVerificationEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(320, "Email address is too long"),
});

export const verifyEmailOtpSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(320, "Email address is too long"),
  code: z
    .string()
    .trim()
    .min(4, "Enter the verification code from your email")
    .max(12, "Code is too long"),
});

export const verifyRecoveryOtpSchema = verifyEmailOtpSchema;

export const signInWithEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(320, "Email address is too long"),
  password: z
    .string()
    .trim()
    .min(1, "Password is required")
    .max(PASSWORD_MAX_LENGTH, "Password is too long"),
});

export const signInWithMagicLinkSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(320, "Email address is too long"),
});

export const passwordSchema = z
  .string()
  .trim()
  .min(1, "Password is required")
  .max(PASSWORD_MAX_LENGTH, "Password is too long")
  .superRefine((value, ctx) => {
    const message = passwordPolicyMessage(value);
    if (message) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message,
      });
    }
  });

export const requestPasswordResetSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(320, "Email address is too long"),
});

export const registerWithEmailInputSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(320, "Email address is too long"),
  password: passwordSchema,
  businessName: z
    .string()
    .trim()
    .max(120, "Business name is too long")
    .optional(),
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().trim().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const resetPasswordInputSchema = z.object({
  password: passwordSchema,
});

export const registerWithEmailSchema = registerWithEmailInputSchema
  .extend({
    confirmPassword: z.string().trim().min(1, "Confirm your password"),
    acceptedTerms: z.literal(true, {
      message: "You must accept the Terms of Service and Privacy Policy.",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const deleteAccountSchema = z.object({
  confirmation: z.literal("DELETE", {
    message: 'Type "DELETE" to confirm account deletion.',
  }),
});

export type AuthCallbackQuery = z.infer<typeof authCallbackQuerySchema>;
export type AuthConfirmQuery = z.infer<typeof authConfirmQuerySchema>;
export type SignInWithEmailInput = z.infer<typeof signInWithEmailSchema>;
export type SignInWithMagicLinkInput = z.infer<typeof signInWithMagicLinkSchema>;
export type ResendVerificationEmailInput = z.infer<
  typeof resendVerificationEmailSchema
>;
export type VerifyEmailOtpInput = z.infer<typeof verifyEmailOtpSchema>;
export type VerifyRecoveryOtpInput = z.infer<typeof verifyRecoveryOtpSchema>;
export type RequestPasswordResetInput = z.infer<
  typeof requestPasswordResetSchema
>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ResetPasswordPayload = z.infer<typeof resetPasswordInputSchema>;

export type RegisterWithEmailInput = z.infer<typeof registerWithEmailSchema>;

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

export type RegisterWithEmailPayload = z.infer<
  typeof registerWithEmailInputSchema
>;

export type AuthActionResult =
  | { success: true }
  | { success: false; error: string };

export type GoogleSignInResult =
  | { success: true; redirectUrl: string }
  | { success: false; error: string };

export type RegistrationErrorCode =
  | "VALIDATION_ERROR"
  | "REGISTRATION_FAILED"
  | "EMAIL_FAILED"
  | "MISSING_CONFIG";

export type RegistrationResult =
  | { success: true; data: { email: string } }
  | {
      success: false;
      error: {
        code: RegistrationErrorCode;
        message: string;
      };
    };

export type LoginErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_CREDENTIALS"
  | "EMAIL_NOT_VERIFIED"
  | "MISSING_CONFIG"
  | "LOGIN_FAILED"
  | "ACCOUNT_LOCKED";

export type LoginResult =
  | { success: true; data: { email: string } }
  | {
      success: false;
      error: {
        code: LoginErrorCode;
        message: string;
      };
    };

export type MagicLinkErrorCode =
  | "VALIDATION_ERROR"
  | "MAGIC_LINK_FAILED"
  | "MISSING_CONFIG"
  | "EMAIL_FAILED";

export type MagicLinkResult =
  | { success: true; data: { email: string } }
  | {
      success: false;
      error: {
        code: MagicLinkErrorCode;
        message: string;
      };
    };

export type VerificationErrorCode =
  | "VALIDATION_ERROR"
  | "VERIFICATION_FAILED"
  | "EMAIL_FAILED"
  | "MISSING_CONFIG"
  | "USER_NOT_FOUND";

export type VerificationResult =
  | { success: true; data: { email: string } }
  | {
      success: false;
      error: {
        code: VerificationErrorCode;
        message: string;
      };
    };

export type PasswordResetErrorCode =
  | "VALIDATION_ERROR"
  | "RESET_FAILED"
  | "EMAIL_FAILED"
  | "MISSING_CONFIG"
  | "INVALID_SESSION";

export type PasswordResetRequestResult =
  | { success: true; data: { email: string } }
  | {
      success: false;
      error: {
        code: PasswordResetErrorCode;
        message: string;
      };
    };

export type PasswordUpdateResult =
  | { success: true }
  | {
      success: false;
      error: {
        code: PasswordResetErrorCode;
        message: string;
      };
    };

export type DeleteAccountErrorCode =
  | "VALIDATION_ERROR"
  | "MISSING_CONFIG"
  | "UNAUTHORIZED"
  | "DELETE_FAILED";

export type DeleteAccountResult =
  | { success: true }
  | {
      success: false;
      error: {
        code: DeleteAccountErrorCode;
        message: string;
      };
    };

export type AuthProviderType = "google" | "email";
