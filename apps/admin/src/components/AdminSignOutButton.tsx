"use client";

import { useTransition } from "react";
import { Loader2Icon, LogOutIcon } from "lucide-react";

import { adminSignOutAction } from "@/features/auth/sign-out-action";

export function AdminSignOutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await adminSignOutAction();
        });
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-60"
    >
      {isPending ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : (
        <LogOutIcon className="size-4" />
      )}
      Выйти
    </button>
  );
}
