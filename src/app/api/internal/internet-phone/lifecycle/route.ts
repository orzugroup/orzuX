import { NextResponse, type NextRequest } from "next/server";

import { verifyVoiceStreamSecret } from "@/lib/voice/stream-config";
import { updateInternetPhoneCallLifecycle } from "@/services/internet-phone.service";

export async function POST(request: NextRequest) {
  if (!verifyVoiceStreamSecret(request.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const body = (await request.json()) as {
    callId?: string;
    event?: string;
    reason?: string;
  };

  const callId = body.callId?.trim();
  const event = body.event?.trim();

  if (!callId || !event) {
    return new NextResponse("Missing callId or event", { status: 400 });
  }

  const allowed = new Set([
    "ai_joined",
    "ai_active",
    "ai_muted",
    "ai_left",
    "ai_failed",
    "customer_ended",
    "staff_requested",
  ]);

  if (!allowed.has(event)) {
    return new NextResponse("Invalid event", { status: 400 });
  }

  await updateInternetPhoneCallLifecycle({
    callId,
    event: event as
      | "ai_joined"
      | "ai_active"
      | "ai_muted"
      | "ai_left"
      | "ai_failed"
      | "customer_ended"
      | "staff_requested",
    reason:
      body.reason === "customer_hangup" ||
      body.reason === "staff_end" ||
      body.reason === "ai_end" ||
      body.reason === "failed" ||
      body.reason === "timeout"
        ? body.reason
        : undefined,
  });

  return NextResponse.json({ ok: true });
}
