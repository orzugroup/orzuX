"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2Icon, ShieldIcon } from "lucide-react";
import { toast } from "sonner";

import {
  ADMIN_DEFAULT_PATH,
  MFA_ENROLL_PATH,
  MFA_VERIFY_PATH,
  resolveAdminMfaGate,
} from "@/lib/mfa";
import { createAdminSupabaseBrowserClient } from "@/lib/supabase/client";

export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const supabase = createAdminSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      const [{ data: aal }, { data: factors }] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ]);

      const verifiedTotpCount = (factors?.totp ?? []).filter(
        (factor) => factor.status === "verified",
      ).length;

      const gate = resolveAdminMfaGate({
        currentLevel: aal?.currentLevel,
        verifiedTotpCount,
      });

      if (gate.kind === "enroll") {
        router.replace(MFA_ENROLL_PATH);
        router.refresh();
        return;
      }

      if (gate.kind === "verify") {
        router.replace(MFA_VERIFY_PATH);
        router.refresh();
        return;
      }

      const next = searchParams.get("next") || ADMIN_DEFAULT_PATH;
      router.replace(next.startsWith("/") ? next : ADMIN_DEFAULT_PATH);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  const forbidden = searchParams.get("error") === "forbidden";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4">
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldIcon className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">OrzuX Admin</h1>
            <p className="text-sm text-muted-foreground">
              Только для платформенных администраторов · MFA обязателен
            </p>
          </div>
        </div>

        {forbidden ? (
          <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            У вашего аккаунта нет прав platform admin.
          </p>
        ) : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-1.5 text-sm">
            <span>Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2"
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span>Пароль</span>
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {isSubmitting ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              "Войти"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
