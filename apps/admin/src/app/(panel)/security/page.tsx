import { AdminMfaStatusPanel } from "@/components/mfa/AdminMfaStatusPanel";
import { SecurityReportPanel } from "@/components/security/SecurityReportPanel";

export default function SecurityPage() {
  return (
    <div className="space-y-6">
      <AdminMfaStatusPanel />
      <SecurityReportPanel />
    </div>
  );
}
