import "server-only";

import { AccessToken } from "livekit-server-sdk";

import { getLiveKitServerConfig } from "@/lib/livekit/config";

const DEFAULT_TTL_SECONDS = 15 * 60;

export async function createInternetPhoneParticipantToken(input: {
  identity: string;
  roomName: string;
  displayName?: string;
  ttlSeconds?: number;
}): Promise<{ token: string; livekitUrl: string } | null> {
  const config = getLiveKitServerConfig();

  if (!config) {
    return null;
  }

  const at = new AccessToken(config.apiKey, config.apiSecret, {
    identity: input.identity,
    name: input.displayName?.trim() || "Caller",
    ttl: input.ttlSeconds ?? DEFAULT_TTL_SECONDS,
  });

  at.addGrant({
    roomJoin: true,
    room: input.roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return {
    token: await at.toJwt(),
    livekitUrl: config.url,
  };
}
