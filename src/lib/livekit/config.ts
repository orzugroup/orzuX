import "server-only";

import { ENV_KEYS } from "@/constants/env-keys";

export type LiveKitServerConfig = {
  url: string;
  apiKey: string;
  apiSecret: string;
};

export function getLiveKitServerConfig(): LiveKitServerConfig | null {
  const url = process.env[ENV_KEYS.LIVEKIT_URL]?.trim() ?? "";
  const apiKey = process.env[ENV_KEYS.LIVEKIT_API_KEY]?.trim() ?? "";
  const apiSecret = process.env[ENV_KEYS.LIVEKIT_API_SECRET]?.trim() ?? "";

  if (!url || !apiKey || !apiSecret) {
    return null;
  }

  return { url, apiKey, apiSecret };
}

export function hasLiveKitEnv(): boolean {
  return getLiveKitServerConfig() !== null;
}
