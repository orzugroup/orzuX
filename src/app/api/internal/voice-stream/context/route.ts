import { NextResponse, type NextRequest } from "next/server";

import { verifyVoiceStreamSecret } from "@/lib/voice/stream-config";
import { getVoiceStreamSessionContext } from "@/services/voice-stream.service";

export async function GET(request: NextRequest) {
  if (!verifyVoiceStreamSecret(request.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const businessId = request.nextUrl.searchParams.get("businessId")?.trim();
  const callSid = request.nextUrl.searchParams.get("callSid")?.trim();
  const directionParam = request.nextUrl.searchParams.get("direction");
  const triggerReason = request.nextUrl.searchParams.get("triggerReason");

  if (!businessId || !callSid) {
    return new NextResponse("Missing businessId or callSid", { status: 400 });
  }

  const direction = directionParam === "outbound" ? "outbound" : "inbound";

  try {
    const context = await getVoiceStreamSessionContext({
      businessId,
      callSid,
      direction,
      triggerReason,
    });

    return NextResponse.json(context);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load voice context.";
    console.error(
      "[voice-stream/context] failed",
      JSON.stringify({ businessId, callSid, triggerReason, message }),
    );
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
