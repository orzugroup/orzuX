/**
 * In-memory access token for browser Realtime / uploads.
 * Never persisted to localStorage, sessionStorage, or non-HttpOnly cookies.
 */

type AccessTokenPayload = {
  accessToken: string;
  expiresAtMs: number;
};

let cached: AccessTokenPayload | null = null;
let inflight: Promise<AccessTokenPayload | null> | null = null;

const REFRESH_SKEW_MS = 60_000;

function expiresAtToMs(expiresAt: number | null | undefined): number {
  if (expiresAt == null || !Number.isFinite(expiresAt)) {
    return Date.now() + 50 * 60 * 1000;
  }

  // Supabase expires_at is unix seconds.
  return expiresAt > 1_000_000_000_000 ? expiresAt : expiresAt * 1000;
}

export function clearAccessTokenCache(): void {
  cached = null;
  inflight = null;
}

export function peekAccessTokenCache(): AccessTokenPayload | null {
  if (!cached) {
    return null;
  }

  if (cached.expiresAtMs <= Date.now() + REFRESH_SKEW_MS) {
    return null;
  }

  return cached;
}

export async function fetchAccessToken(): Promise<AccessTokenPayload | null> {
  const fresh = peekAccessTokenCache();

  if (fresh) {
    return fresh;
  }

  if (inflight) {
    return inflight;
  }

  inflight = (async () => {
    try {
      const response = await fetch("/api/auth/access-token", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        cached = null;
        return null;
      }

      const body = (await response.json()) as {
        success?: boolean;
        accessToken?: string;
        expiresAt?: number | null;
      };

      if (!body.success || !body.accessToken?.trim()) {
        cached = null;
        return null;
      }

      const payload: AccessTokenPayload = {
        accessToken: body.accessToken.trim(),
        expiresAtMs: expiresAtToMs(body.expiresAt),
      };

      cached = payload;
      return payload;
    } catch {
      cached = null;
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
