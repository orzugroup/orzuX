import "server-only";

import { ENV_KEYS } from "@/constants/env-keys";

export type InternetPhoneAgentJoinPayload = {
  callId: string;
  businessId: string;
  roomName: string;
  livekitUrl: string;
  token: string;
  aiIdentity: string;
  callKey: string;
};

function getAgentBaseUrl(): string | null {
  return process.env[ENV_KEYS.LIVEKIT_AGENT_URL]?.trim().replace(/\/$/, "") || null;
}

function getAgentSecret(): string | null {
  return process.env[ENV_KEYS.VOICE_STREAM_SECRET]?.trim() || null;
}

export function isInternetPhoneAgentConfigured(): boolean {
  return Boolean(getAgentBaseUrl() && getAgentSecret());
}

export async function dispatchInternetPhoneAgentJoin(
  payload: InternetPhoneAgentJoinPayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const baseUrl = getAgentBaseUrl();
  const secret = getAgentSecret();

  if (!baseUrl || !secret) {
    return { ok: false, error: "LIVEKIT_AGENT_URL is not configured" };
  }

  try {
    const response = await fetch(`${baseUrl}/join`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        ok: false,
        error: text || `Agent join failed (${response.status})`,
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Agent dispatch failed",
    };
  }
}

export async function controlInternetPhoneAgent(input: {
  callId: string;
  action: "handoff" | "end" | "resume_ai";
}): Promise<void> {
  const baseUrl = getAgentBaseUrl();
  const secret = getAgentSecret();
  if (!baseUrl || !secret) return;

  await fetch(`${baseUrl}/control`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  }).catch(() => undefined);
}
