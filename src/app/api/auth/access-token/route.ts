import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Returns a short-lived access token for browser Realtime / storage uploads.
 * Refresh token stays in HttpOnly cookies; this route never returns refresh_token.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.access_token) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      success: true,
      accessToken: session.access_token,
      expiresAt: session.expires_at ?? null,
    },
    {
      headers: {
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
    },
  );
}
