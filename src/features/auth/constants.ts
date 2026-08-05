export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

export const REGISTRATION_MESSAGES = {
  confirmationTitle: "Enter verification code",
  confirmationDescription:
    "We emailed a confirmation code. Enter it below to activate your account.",
  emailFailed:
    "Your account was created, but we could not send the verification email. Please contact support.",
  alreadyRegistered:
    "An account with this email already exists. Try signing in instead.",
  genericError: "Unable to create your account. Please try again.",
  otpInvalid: "Invalid or expired verification code. Please try again.",
  otpVerifyButton: "Verify email",
  otpVerifying: "Verifying…",
  otpCodeLabel: "Verification code",
  otpCodePlaceholder: "6-digit code",
} as const;

export const LOGIN_MESSAGES = {
  invalidCredentials: "Invalid email or password. Please try again.",
  accountLocked:
    "Too many failed sign-in attempts. Please wait before trying again.",
  tooManyAttempts: "Too many sign-in attempts. Please try again later.",
  emailNotVerified:
    "Please verify your email before signing in. Check your inbox or resend the verification email.",
  genericError: "Unable to sign in. Please try again.",
} as const;

export const GOOGLE_SIGN_IN_MESSAGES = {
  genericError: "Unable to start Google sign-in. Please try again.",
  missingRedirectUrl: "Google sign-in did not return a redirect URL.",
} as const;

export const MAGIC_LINK_MESSAGES = {
  requestTitle: "Sign in with email link",
  requestDescription:
    "We will email you a secure one-time link — no password needed.",
  confirmationTitle: "Check your email",
  confirmationDescription:
    "If an account exists for this email, you will receive a sign-in link shortly.",
  sendButton: "Email me a sign-in link",
  sending: "Sending link…",
  genericError: "Unable to send sign-in link. Please try again.",
  usePassword: "Sign in with password",
  useMagicLink: "Sign in with email link",
} as const;

export const VERIFICATION_MESSAGES = {
  successTitle: "Email verified",
  successDescription:
    "Your email has been verified. You now have access to the dashboard.",
  resendSuccess: "Verification email sent. Check your inbox.",
  resendFailed: "Unable to resend verification email. Please try again.",
  invalidLink: "This verification link is invalid or has expired.",
} as const;

export const PASSWORD_RESET_MESSAGES = {
  requestTitle: "Reset your password",
  requestDescription:
    "Enter your email and we will send a confirmation code to reset your password.",
  confirmationTitle: "Enter reset code",
  confirmationDescription:
    "If an account exists for this email, enter the code from your inbox.",
  resetTitle: "Choose a new password",
  resetDescription: "Enter a new password for your OrzuX account.",
  successTitle: "Password updated",
  successDescription:
    "Your password has been updated. You can now sign in with your new password.",
  invalidSession:
    "This password reset code is invalid or has expired. Please request a new one.",
  genericError: "Unable to reset your password. Please try again.",
  sendCodeButton: "Send reset code",
  sendingCode: "Sending code…",
  otpCodeLabel: "Confirmation code",
  otpVerifyButton: "Continue",
  otpVerifying: "Checking code…",
} as const;

export const ACCOUNT_DELETION_MESSAGES = {
  sectionTitle: "Delete Account",
  sectionDescription:
    "Permanently delete your account and all associated business data.",
  warning:
    "This action cannot be undone. Your profile, business, conversations, contacts, knowledge base, WhatsApp connection, and analytics will be permanently removed.",
  confirmationLabel: 'Type "DELETE" to confirm',
  buttonLabel: "Delete my account",
  success: "Your account has been deleted.",
  genericError: "Unable to delete your account. Please try again or contact support.",
  termsRequired: "You must accept the Terms of Service and Privacy Policy.",
} as const;
