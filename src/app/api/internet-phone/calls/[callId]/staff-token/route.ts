import { NextResponse, type NextRequest } from "next/server";

import { mintInternetPhoneStaffToken } from "@/services/internet-phone.service";

type RouteContext = {
  params: Promise<{ callId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { callId } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    mode?: string;
  } | null;

  const mode = body?.mode === "talk" ? "talk" : "listen";
  const result = await mintInternetPhoneStaffToken({ callId, mode });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.data);
}
