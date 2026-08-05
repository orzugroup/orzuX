import "server-only";

import {
  deleteRedisCacheKey,
  getRedisCacheValue,
  setRedisCacheValue,
} from "@/lib/cache/redis";

const PROFILE_CACHE_TTL_SECONDS = 5 * 60;
const PROFILE_CACHE_PREFIX = "ai:assistant-profile:v1:";

export function buildAssistantProfileCacheKey(businessId: string): string {
  return `${PROFILE_CACHE_PREFIX}${businessId}`;
}

export async function readCachedAssistantProfileRow<T>(
  businessId: string,
): Promise<T | null> {
  const cached = await getRedisCacheValue(buildAssistantProfileCacheKey(businessId));

  if (!cached) {
    return null;
  }

  try {
    return JSON.parse(cached) as T;
  } catch {
    return null;
  }
}

export async function writeCachedAssistantProfileRow(
  businessId: string,
  row: Record<string, unknown>,
): Promise<void> {
  await setRedisCacheValue(
    buildAssistantProfileCacheKey(businessId),
    JSON.stringify(row),
    PROFILE_CACHE_TTL_SECONDS,
  );
}

export async function invalidateAssistantProfileCache(
  businessId: string,
): Promise<void> {
  await deleteRedisCacheKey(buildAssistantProfileCacheKey(businessId));
}
