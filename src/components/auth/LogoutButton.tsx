"use client";

import { Loader2Icon, LogOutIcon } from "lucide-react";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { signOutAction } from "@/features/auth/actions/sign-out";
import { prepareBrowserSignOut } from "@/lib/supabase/client-sign-out";
import { cn } from "@/lib/utils";

type LogoutButtonProps = {
  className?: string;
  variant?: "default" | "outline" | "ghost" | "destructive" | "secondary" | "link";
  size?: "default" | "sm" | "lg" | "icon" | "xs" | "icon-xs" | "icon-sm" | "icon-lg";
};

export function LogoutButton({
  className,
  variant = "outline",
  size = "default",
}: LogoutButtonProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn(className)}
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          prepareBrowserSignOut();
          await signOutAction();
        });
      }}
    >
      {isPending ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : (
        <LogOutIcon className="size-4" />
      )}
      Log out
    </Button>
  );
}
