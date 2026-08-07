import { createHmac, timingSafeEqual } from "crypto";

export function getEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function requireEnv(name: string): string {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

export function verifyBearerSecret(
  authorization: string | undefined,
  secret: string,
): boolean {
  const provided = authorization?.replace(/^Bearer\s+/i, "").trim();
  if (!provided) return false;

  const left = Buffer.from(provided);
  const right = Buffer.from(secret);

  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export type VoiceStreamContext = {
  businessId: string;
  businessName: string;
  language: string;
  languageCode?: string;
  voiceId: string;
  openingLine: string;
  errorPrompt: string;
  repeatPrompt: string;
  direction: "inbound" | "outbound";
  deepgramLanguage: string;
  systemPrompt?: string;
  llmModel?: string;
  llmProvider?: string;
};

export type VoiceStreamReplyResult = {
  text: string;
  endCall?: boolean;
};

export async function fetchVoiceStreamContext(input: {
  appUrl: string;
  secret: string;
  businessId: string;
  callSid: string;
}): Promise<VoiceStreamContext> {
  const url = new URL(`${input.appUrl}/api/internal/voice-stream/context`);
  url.searchParams.set("businessId", input.businessId);
  url.searchParams.set("callSid", input.callSid);
  url.searchParams.set("direction", "inbound");
  url.searchParams.set("triggerReason", "internet_phone");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${input.secret}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Context fetch failed (${response.status})`);
  }

  return (await response.json()) as VoiceStreamContext;
}

export async function requestVoiceStreamReply(input: {
  appUrl: string;
  secret: string;
  businessId: string;
  callSid: string;
  userMessage: string;
}): Promise<VoiceStreamReplyResult> {
  const response = await fetch(
    `${input.appUrl}/api/internal/voice-stream/reply`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        businessId: input.businessId,
        callSid: input.callSid,
        direction: "inbound",
        userMessage: input.userMessage,
        triggerReason: "internet_phone",
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Reply fetch failed (${response.status})`);
  }

  return (await response.json()) as VoiceStreamReplyResult;
}

export async function appendVoiceStreamTurn(input: {
  appUrl: string;
  secret: string;
  businessId: string;
  callSid: string;
  role: "user" | "assistant";
  content: string;
}): Promise<void> {
  await fetch(`${input.appUrl}/api/internal/voice-stream/turn`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    cache: "no-store",
  }).catch(() => undefined);
}

export async function notifyInternetPhoneLifecycle(input: {
  appUrl: string;
  secret: string;
  callId: string;
  event:
    | "ai_joined"
    | "ai_active"
    | "ai_muted"
    | "ai_left"
    | "ai_failed"
    | "staff_requested";
}): Promise<void> {
  await fetch(`${input.appUrl}/api/internal/internet-phone/lifecycle`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      callId: input.callId,
      event: input.event,
    }),
    cache: "no-store",
  }).catch((error) => {
    console.warn(
      "[livekit-voice-agent] lifecycle notify failed",
      error instanceof Error ? error.message : "unknown",
    );
  });
}

export function signJoinIdempotency(callId: string, secret: string): string {
  return createHmac("sha256", secret).update(callId).digest("hex").slice(0, 16);
}
