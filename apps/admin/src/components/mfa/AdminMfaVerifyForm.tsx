"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { adminSignOutAction } from "@/features/auth/sign-out-action";
import { verifyTotpChallengeAction } from "@/features/mfa/actions";
import { ADMIN_DEFAULT_PATH } from "@/lib/mfa";

export function AdminMfaVerifyForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    startTransition(async () => {
      const result = await verifyTotpChallengeAction({ code });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("MFA verified");
      router.replace(ADMIN_DEFAULT_PATH);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Enter the 6-digit code from your authenticator app to unlock the
        platform admin console.
      </p>

      <form className="space-y-3" onSubmit={handleSubmit}>
        <label className="block space-y-1.5 text-sm">
          <span>Authenticator code</span>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
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
            "Verify and continue"
          )}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          startTransition(async () => {
            await adminSignOutAction();
          });
        }}
        className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        Sign out
      </button>
    </div>
  );
}
