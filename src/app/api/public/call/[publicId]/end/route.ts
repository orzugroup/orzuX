import { NextResponse, type NextRequest } from "next/server";

import { updateInternetPhoneCallLifecycle } from "@/services/internet-phone.service";

type RouteContext = {
  params: Promise<{ publicId: string }>;
};

export async function POST(request: NextRequest, _context: RouteContext) {
  const body = (await request.json().catch(() => null)) as {
    callId?: string;
  } | null;

  const callId = body?.callId?.trim();
  if (!callId) {
    return NextResponse.json({ error: "Missing callId" }, { status: 400 });
  }

  await updateInternetPhoneCallLifecycle({
    callId,
    event: "customer_ended",
    reason: "customer_hangup",
  });

  return NextResponse.json({ ok: true });
}
