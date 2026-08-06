import type { ReactNode } from "react";
import { ShieldCheckIcon } from "lucide-react";

type AdminMfaShellProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function AdminMfaShell({
  title,
  description,
  children,
}: AdminMfaShellProps) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="mb-6 flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheckIcon className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
