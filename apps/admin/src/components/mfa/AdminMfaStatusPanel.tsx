"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2Icon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/ui/StatusBadge";
import { SectionCard } from "@/components/ui/SectionCard";
import {
  getAdminMfaStatusAction,
  unenrollTotpFactorAction,
  type AdminMfaStatus,
} from "@/features/mfa/actions";

export function AdminMfaStatusPanel() {
  const [status, setStatus] = useState<AdminMfaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  async function loadStatus() {
    setLoading(true);
    const result = await getAdminMfaStatusAction();
    if (!result.success) {
      toast.error(result.error);
      setLoading(false);
      return;
    }
    setStatus(result.data);
    setLoading(false);
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  function handleUnenroll(factorId: string) {
    startTransition(async () => {
      const result = await unenrollTotpFactorAction({ factorId });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Authenticator removed");
      await loadStatus();
    });
  }

  return (
    <SectionCard
      title="Multi-factor authentication (admin)"
      description="Platform admin access requires Supabase Auth TOTP (AAL2) after password login."
      icon={ShieldCheckIcon}
    >
      {loading || !status ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Loading MFA status…
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <StatusBadge
              tone={status.currentLevel === "aal2" ? "success" : "warning"}
              label={`Session: ${status.currentLevel?.toUpperCase() ?? "unknown"}`}
            />
            <StatusBadge
              tone={status.verifiedTotpCount > 0 ? "success" : "warning"}
              label={`Verified authenticators: ${status.verifiedTotpCount}`}
            />
          </div>

          <ul className="space-y-2">
            {status.factors.length === 0 ? (
              <li className="text-sm text-muted-foreground">
                No authenticator enrolled.
              </li>
            ) : (
              status.factors.map((factor) => (
                <li
                  key={factor.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {factor.friendlyName ?? "Authenticator"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {factor.status} · {new Date(factor.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {factor.status === "verified" &&
                  status.verifiedTotpCount > 1 ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleUnenroll(factor.id)}
                      className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-60"
                    >
                      Remove
                    </button>
                  ) : null}
                </li>
              ))
            )}
          </ul>

          <p className="text-xs text-muted-foreground">
            Middleware blocks admin routes until a verified TOTP factor exists and
            the session reaches AAL2. Privileged server actions call
            requirePlatformAdmin() with the same check.
          </p>
        </div>
      )}
    </SectionCard>
  );
}
