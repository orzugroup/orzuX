import "server-only";

import Stripe from "stripe";

import { ENV_KEYS } from "@/constants/env-keys";

let stripeClient: Stripe | null = null;

export function hasStripeEnv(): boolean {
  return Boolean(process.env[ENV_KEYS.STRIPE_SECRET_KEY]?.trim());
}

export function getStripeClient(): Stripe {
  const secretKey = process.env[ENV_KEYS.STRIPE_SECRET_KEY]?.trim();

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      // Always match the installed stripe package's pinned LatestApiVersion.
      apiVersion: Stripe.API_VERSION,
    });
  }

  return stripeClient;
}
