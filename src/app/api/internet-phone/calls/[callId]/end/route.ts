import { NextResponse, type NextRequest } from "next/server";

import { endInternetPhoneCall } from "@/services/internet-phone.service";

type RouteContext = {
  params: Promise<{ callId: string }>;
};

export async function POST(_request: NextRequest, context: RouteContext) {
  const { callId } = await context.params;
  const result = await endInternetPhoneCall({
    callId,
    reason: "staff_end",
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
