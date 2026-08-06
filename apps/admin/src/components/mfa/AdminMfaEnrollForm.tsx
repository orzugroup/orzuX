"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import {
  confirmTotpEnrollmentAction,
  startTotpEnrollmentAction,
} from "@/features/mfa/actions";
import { ADMIN_DEFAULT_PATH } from "@/lib/mfa";
import { createAdminSupabaseBrowserClient } from "@/lib/supabase/client";

export function AdminMfaEnrollForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loadingEnrollment, setLoadingEnrollment] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function startEnrollment() {
      setLoadingEnrollment(true);
      const result = await startTotpEnrollmentAction();

      if (cancelled) {
        return;
      }

      if (!result.success) {
        toast.error(result.error);
        setLoadingEnrollment(false);
        return;
      }

      setFactorId(result.data.factorId);
      setQrCode(result.data.qrCode);
      setSecret(result.data.secret);
      setLoadingEnrollment(false);
    }

    void startEnrollment();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleConfirm(event: React.FormEvent) {
    event.preventDefault();

    if (!factorId) {
      toast.error("Enrollment is not ready yet");
      return;
    }

    startTransition(async () => {
      const result = await confirmTotpEnrollmentAction({
        factorId,
        code,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Authenticator enrolled. Admin access unlocked.");
      router.replace(ADMIN_DEFAULT_PATH);
      router.refresh();
    });
  }

  async function handleSignOut() {
    const supabase = createAdminSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (loadingEnrollment) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" />
        Preparing authenticator enrollment…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        <li>Open Google Authenticator, Authy, or 1Password.</li>
        <li>Scan the QR code (or enter the secret manually).</li>
        <li>Enter the 6-digit code to confirm enrollment.</li>
      </ol>

      {qrCode ? (
        <div className="flex justify-center rounded-xl border bg-white p-4">
          {/* Supabase returns a data:image/svg+xml QR payload */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrCode}
            alt="TOTP QR code for OrzuX Admin"
            className="size-48"
          />
        </div>
      ) : null}

      {secret ? (
        <div className="rounded-lg border bg-muted/40 px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground">
            Manual setup key
          </p>
          <p className="mt-1 break-all font-mono text-sm tracking-wide">
            {secret}
          </p>
        </div>
      ) : null}

      <form className="space-y-3" onSubmit={handleConfirm}>
        <label className="block space-y-1.5 text-sm">
          <span>Authenticator code</span>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            className="w-full rounded-lg border bg-background px-3 py-2 tracking-[0.3em]"
            placeholder="000000"
          />
        </label>
        <button
          type="submit"
          disabled={isPending || code.length !== 6}
          className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {isPending ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            "Confirm and continue"
          )}
        </button>
      </form>

      <button
        type="button"
        onClick={() => void handleSignOut()}
        className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        Sign out
      </button>
    </div>
  );
}
