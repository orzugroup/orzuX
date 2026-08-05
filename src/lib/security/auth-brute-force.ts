import "server-only";

import { Redis } from "@upstash/redis";

export const AUTH_LOGIN_LIMITS = {
  /** Failed password attempts per email before temporary lockout. */
  maxFailuresBeforeLock: 5,
  /** Lockout duration after too many failures (seconds). */
  lockoutSeconds: 15 * 60,
  /** Window for counting failures (seconds). */
  failureWindowSeconds: 15 * 60,
  /** Minimum wait between login attempts for the same email (seconds). */
  minSecondsBetweenAttempts: 3,
  /** Max login attempts per IP in the failure window. */
  ipMaxAttemptsPerWindow: 30,
  ipWindowSeconds: 15 * 60,
  /** OTP / recovery code verify attempts per email. */
  otpMaxAttempts: 5,
  otpWindowSeconds: 15 * 60,
  /** Password reset email requests per hour per email. */
  passwordResetMaxPerHour: 5,
  passwordResetWindowSeconds: 60 * 60,
} as const;

export type AuthGuardResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
  reason?: "locked" | "too_fast" | "rate_limited" | "otp_limited" | "redis_required";
};

let redisClient: Redis | null = null;
let redisUnavailable = false;

function getRedis(): Redis | null {
  if (redisUnavailable) {
    return null;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    redisUnavailable = true;
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis({ url, token });
  }

  return redisClient;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isProductionAuthGuardStrict(): boolean {
  return process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
}

function redisRequiredBlock(): AuthGuardResult {
  if (isProductionAuthGuardStrict()) {
    return {
      allowed: false,
      reason: "redis_required",
      retryAfterSeconds: 60,
    };
  }

  return { allowed: true };
}

export async function assertLoginAllowed(
  email: string,
  ipAddress: string | null,
): Promise<AuthGuardResult> {
  const redis = getRedis();

  if (!redis) {
    return redisRequiredBlock();
  }

  const normalized = normalizeEmail(email);
  const ip = ipAddress?.trim() || "unknown";

  try {
    const lockTtl = await redis.ttl(`auth:login:lock:${normalized}`);

    if (lockTtl > 0) {
      return {
        allowed: false,
        reason: "locked",
        retryAfterSeconds: lockTtl,
      };
    }

    const lastAttempt = await redis.get<number>(`auth:login:last:${normalized}`);

    if (typeof lastAttempt === "number") {
      const elapsed = Math.floor(Date.now() / 1000) - lastAttempt;

      if (elapsed < AUTH_LOGIN_LIMITS.minSecondsBetweenAttempts) {
        return {
          allowed: false,
          reason: "too_fast",
          retryAfterSeconds:
            AUTH_LOGIN_LIMITS.minSecondsBetweenAttempts - elapsed,
        };
      }
    }

    const ipKey = `auth:login:ip:${ip}`;
    const ipCount = await redis.incr(ipKey);

    if (ipCount === 1) {
      await redis.expire(ipKey, AUTH_LOGIN_LIMITS.ipWindowSeconds);
    }

    if (ipCount > AUTH_LOGIN_LIMITS.ipMaxAttemptsPerWindow) {
      return {
        allowed: false,
        reason: "rate_limited",
        retryAfterSeconds: AUTH_LOGIN_LIMITS.ipWindowSeconds,
      };
    }

    await redis.set(`auth:login:last:${normalized}`, Math.floor(Date.now() / 1000), {
      ex: 120,
    });

    return { allowed: true };
  } catch (error) {
    console.error("[auth-guard] login check failed", error);
    return isProductionAuthGuardStrict()
      ? { allowed: false, reason: "redis_required", retryAfterSeconds: 60 }
      : { allowed: true };
  }
}

export async function recordLoginFailure(
  email: string,
): Promise<{ locked: boolean; retryAfterSeconds?: number }> {
  const redis = getRedis();

  if (!redis) {
    return { locked: false };
  }

  const normalized = normalizeEmail(email);
  const failKey = `auth:login:fail:${normalized}`;

  try {
    const count = await redis.incr(failKey);

    if (count === 1) {
      await redis.expire(failKey, AUTH_LOGIN_LIMITS.failureWindowSeconds);
    }

    if (count >= AUTH_LOGIN_LIMITS.maxFailuresBeforeLock) {
      await redis.set(`auth:login:lock:${normalized}`, "1", {
        ex: AUTH_LOGIN_LIMITS.lockoutSeconds,
      });
      await redis.del(failKey);

      return {
        locked: true,
        retryAfterSeconds: AUTH_LOGIN_LIMITS.lockoutSeconds,
      };
    }

    return { locked: false };
  } catch (error) {
    console.error("[auth-guard] record login failure failed", error);
    return { locked: false };
  }
}

export async function clearLoginFailures(email: string): Promise<void> {
  const redis = getRedis();

  if (!redis) {
    return;
  }

  const normalized = normalizeEmail(email);

  try {
    await redis.del(`auth:login:fail:${normalized}`, `auth:login:lock:${normalized}`);
  } catch (error) {
    console.error("[auth-guard] clear login failures failed", error);
  }
}

export async function assertOtpVerifyAllowed(
  email: string,
  kind: "email" | "recovery",
): Promise<AuthGuardResult> {
  const redis = getRedis();

  if (!redis) {
    return redisRequiredBlock();
  }

  const normalized = normalizeEmail(email);
  const key = `auth:otp:fail:${kind}:${normalized}`;

  try {
    const countRaw = await redis.get<number>(key);
    const count = typeof countRaw === "number" ? countRaw : 0;

    if (count >= AUTH_LOGIN_LIMITS.otpMaxAttempts) {
      return {
        allowed: false,
        reason: "otp_limited",
        retryAfterSeconds: AUTH_LOGIN_LIMITS.otpWindowSeconds,
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error("[auth-guard] otp check failed", error);
    return isProductionAuthGuardStrict()
      ? { allowed: false, reason: "redis_required", retryAfterSeconds: 60 }
      : { allowed: true };
  }
}

export async function recordOtpVerifyFailure(
  email: string,
  kind: "email" | "recovery",
): Promise<void> {
  const redis = getRedis();

  if (!redis) {
    return;
  }

  const normalized = normalizeEmail(email);
  const key = `auth:otp:fail:${kind}:${normalized}`;

  try {
    const count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, AUTH_LOGIN_LIMITS.otpWindowSeconds);
    }
  } catch (error) {
    console.error("[auth-guard] record otp failure failed", error);
  }
}

export async function clearOtpVerifyFailures(
  email: string,
  kind: "email" | "recovery",
): Promise<void> {
  const redis = getRedis();

  if (!redis) {
    return;
  }

  const normalized = normalizeEmail(email);

  try {
    await redis.del(`auth:otp:fail:${kind}:${normalized}`);
  } catch (error) {
    console.error("[auth-guard] clear otp failures failed", error);
  }
}

export async function assertPasswordResetRequestAllowed(
  email: string,
): Promise<AuthGuardResult> {
  const redis = getRedis();

  if (!redis) {
    return redisRequiredBlock();
  }

  const normalized = normalizeEmail(email);
  const key = `auth:reset:req:${normalized}`;

  try {
    const count = await redis.incr(key);

    if (count === 1) {
      await redis.expire(key, AUTH_LOGIN_LIMITS.passwordResetWindowSeconds);
    }

    if (count > AUTH_LOGIN_LIMITS.passwordResetMaxPerHour) {
      return {
        allowed: false,
        reason: "rate_limited",
        retryAfterSeconds: AUTH_LOGIN_LIMITS.passwordResetWindowSeconds,
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error("[auth-guard] reset request check failed", error);
    return isProductionAuthGuardStrict()
      ? { allowed: false, reason: "redis_required", retryAfterSeconds: 60 }
      : { allowed: true };
  }
}

export function formatAuthGuardMessage(result: AuthGuardResult): string {
  const minutes = result.retryAfterSeconds
    ? Math.max(1, Math.ceil(result.retryAfterSeconds / 60))
    : 15;

  switch (result.reason) {
    case "locked":
      return `Too many failed sign-in attempts. Try again in about ${minutes} minute(s).`;
    case "too_fast":
      return "Please wait a few seconds before trying to sign in again.";
    case "otp_limited":
      return `Too many incorrect codes. Try again in about ${minutes} minute(s).`;
    case "rate_limited":
      return "Too many requests from this network. Please try again later.";
    case "redis_required":
      return "Sign-in protection is temporarily unavailable. Please try again shortly.";
    default:
      return "Unable to sign in right now. Please try again later.";
  }
}
