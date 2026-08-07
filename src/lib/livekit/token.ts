import "server-only";

import { AccessToken } from "livekit-server-sdk";

import { getLiveKitServerConfig } from "@/lib/livekit/config";

const DEFAULT_TTL_SECONDS = 15 * 60;
const AGENT_TTL_SECONDS = 60 * 60;

export type InternetPhoneParticipantRole =
  | "visitor"
  | "ai"
  | "staff"
  | "monitor";

export async function createInternetPhoneParticipantToken(input: {
  identity: string;
  roomName: string;
  displayName?: string;
  role?: InternetPhoneParticipantRole;
  ttlSeconds?: number;
}): Promise<{ token: string; livekitUrl: string } | null> {
  const config = getLiveKitServerConfig();

  if (!config) {
    return null;
  }

  const role = input.role ?? "visitor";
  const canPublish = role === "visitor" || role === "ai" || role === "staff";
  const defaultTtl =
    role === "ai" || role === "staff" || role === "monitor"
      ? AGENT_TTL_SECONDS
      : DEFAULT_TTL_SECONDS;

  const at = new AccessToken(config.apiKey, config.apiSecret, {
    identity: input.identity,
    name: input.displayName?.trim() || defaultDisplayName(role),
    ttl: input.ttlSeconds ?? defaultTtl,
  });

  at.addGrant({
    roomJoin: true,
    room: input.roomName,
    canPublish,
    canSubscribe: true,
    canPublishData: true,
  });

  return {
    token: await at.toJwt(),
    livekitUrl: config.url,
  };
}

function defaultDisplayName(role: InternetPhoneParticipantRole): string {
  switch (role) {
    case "ai":
      return "AI Agent";
    case "staff":
      return "Staff";
    case "monitor":
      return "Monitor";
    default:
      return "Caller";
  }
}
