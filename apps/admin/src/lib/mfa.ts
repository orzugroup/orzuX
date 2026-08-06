export const MFA_ENROLL_PATH = "/mfa/enroll";
export const MFA_VERIFY_PATH = "/mfa/verify";
export const ADMIN_LOGIN_PATH = "/login";
export const ADMIN_DEFAULT_PATH = "/dashboard";

export type AdminMfaGate =
  | { kind: "allow" }
  | { kind: "enroll" }
  | { kind: "verify" };

export type TotpFactorSummary = {
  id: string;
  friendlyName: string | null;
  status: "verified" | "unverified";
  createdAt: string;
};

export function isMfaSetupPath(pathname: string): boolean {
  return (
    pathname === MFA_ENROLL_PATH ||
    pathname.startsWith(`${MFA_ENROLL_PATH}/`) ||
    pathname === MFA_VERIFY_PATH ||
    pathname.startsWith(`${MFA_VERIFY_PATH}/`)
  );
}

export function resolveAdminMfaGate(input: {
  currentLevel: string | null | undefined;
  verifiedTotpCount: number;
}): AdminMfaGate {
  if (input.verifiedTotpCount < 1) {
    return { kind: "enroll" };
  }

  if (input.currentLevel !== "aal2") {
    return { kind: "verify" };
  }

  return { kind: "allow" };
}

export function normalizeTotpCode(code: string): string {
  return code.replace(/\s+/g, "").trim();
}

export function isValidTotpCode(code: string): boolean {
  return /^\d{6}$/.test(normalizeTotpCode(code));
}
