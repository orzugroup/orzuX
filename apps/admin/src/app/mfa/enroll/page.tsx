import { AdminMfaEnrollForm } from "@/components/mfa/AdminMfaEnrollForm";
import { AdminMfaShell } from "@/components/mfa/AdminMfaShell";

export const metadata = {
  title: "Enroll MFA | OrzuX Admin",
  robots: { index: false, follow: false },
};

export default function AdminMfaEnrollPage() {
  return (
    <AdminMfaShell
      title="Set up multi-factor authentication"
      description="Platform admin access requires a TOTP authenticator. This protects administrative interfaces against unauthorized use of a stolen password."
    >
      <AdminMfaEnrollForm />
    </AdminMfaShell>
  );
}
