import { AdminMfaShell } from "@/components/mfa/AdminMfaShell";
import { AdminMfaVerifyForm } from "@/components/mfa/AdminMfaVerifyForm";

export const metadata = {
  title: "Verify MFA | OrzuX Admin",
  robots: { index: false, follow: false },
};

export default function AdminMfaVerifyPage() {
  return (
    <AdminMfaShell
      title="Verify multi-factor authentication"
      description="Password verified. Complete the second factor to continue to the admin console."
    >
      <AdminMfaVerifyForm />
    </AdminMfaShell>
  );
}
