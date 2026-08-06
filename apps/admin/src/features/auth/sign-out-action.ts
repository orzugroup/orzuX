"use server";

import { redirect } from "next/navigation";

import { markOfflineAction } from "@/features/team/presence-actions";
import { ADMIN_LOGIN_PATH } from "@/lib/mfa";
import { createAdminSupabaseServerClient } from "@/lib/supabase/server";

/** Clears HttpOnly auth cookies via the server client, then redirects to login. */
export async function adminSignOutAction(): Promise<void> {
  await markOfflineAction({ eventType: "logout" });

  const supabase = await createAdminSupabaseServerClient();
  await supabase.auth.signOut();

  redirect(ADMIN_LOGIN_PATH);
}
