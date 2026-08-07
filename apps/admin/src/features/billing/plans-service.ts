import "server-only";

import Stripe from "stripe";
import { z } from "zod";

import { buildPlanFeaturesFromEntitlements } from "@orzuai/features/subscription/plan-features";
import type { PlanEntitlements } from "@orzuai/features/subscription/entitlements";
import type {
  PlatformPlanRecord,
  PlatformSubscriptionAddonRow,
  UpsertPlatformAddonInput,
  UpsertPlatformPlanInput,
} from "@orzuai/types/platform-plans.types";

import { getSecret } from "@orzu/secrets/server";

import { createServiceRoleClient } from "@/lib/supabase/server";

const planEntitlementsSchema = z.object({
  maxMessagingChannels: z.number().int(),
  maxTeamSeats: z.number().int().min(1),
  monthlyAiReplies: z.number().int().min(-1),
  monthlyVoiceMinutes: z.number().int().min(0),
  maxAutomationRules: z.number().int().min(-1),
  voiceAi: z.boolean(),
  automations: z.boolean(),
  followUpAgent: z.boolean(),
  analyticsAiAsk: z.boolean(),
  gmailIntegration: z.boolean(),
  websiteKnowledgeSync: z.boolean(),
  extendedAiContext: z.boolean(),
  calendarBookingPages: z.boolean(),
  prioritySupport: z.boolean(),
});

type PlanRow = {
  id: string;
  label: string;
  tagline: string;
  price_monthly_cents: number;
  sort_order: number;
  is_active: boolean;
  is_public: boolean;
  highlighted: boolean;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  entitlements: PlanEntitlements;
  features: string[];
};

function mapPlanRow(row: PlanRow): PlatformPlanRecord {
  const entitlements = planEntitlementsSchema.parse(row.entitlements);
  const features =
    row.features.length > 0
      ? row.features
      : buildPlanFeaturesFromEntitlements(entitlements);

  return {
    id: row.id,
    label: row.label,
    tagline: row.tagline,
    priceMonthly: row.price_monthly_cents / 100,
    priceMonthlyCents: row.price_monthly_cents,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    isPublic: row.is_public,
    highlighted: row.highlighted,
    stripeProductId: row.stripe_product_id,
    stripePriceId: row.stripe_price_id,
    entitlements,
    features,
    monthlyAiReplies: entitlements.monthlyAiReplies,
  };
}

async function resolveStripeSecretKey(): Promise<string> {
  const fromEnv = process.env.STRIPE_SECRET_KEY?.trim();

  if (fromEnv) {
    return fromEnv;
  }

  const service = createServiceRoleClient();
  const fromSecrets = (await getSecret(service, "STRIPE_SECRET_KEY"))?.trim();

  if (fromSecrets) {
    return fromSecrets;
  }

  throw new Error("STRIPE_SECRET_KEY is not configured.");
}

async function getStripeClient(): Promise<Stripe> {
  const secretKey = await resolveStripeSecretKey();
  return new Stripe(secretKey, { apiVersion: Stripe.API_VERSION });
}

export async function listAdminPlatformPlans(): Promise<PlatformPlanRecord[]> {
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("platform_subscription_plans")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to load plans.");
  }

  return data.map((row) => mapPlanRow(row as unknown as PlanRow));
}

export async function upsertAdminPlatformPlan(
  input: UpsertPlatformPlanInput,
): Promise<PlatformPlanRecord> {
  const parsedEntitlements = planEntitlementsSchema.parse(input.entitlements);
  const features =
    input.features && input.features.length > 0
      ? input.features
      : buildPlanFeaturesFromEntitlements(parsedEntitlements);

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("platform_subscription_plans")
    .upsert({
      id: input.id.trim().toLowerCase(),
      label: input.label.trim(),
      tagline: input.tagline?.trim() ?? "",
      price_monthly_cents: input.priceMonthlyCents,
      sort_order: input.sortOrder ?? 0,
      is_active: input.isActive ?? true,
      is_public: input.isPublic ?? true,
      highlighted: input.highlighted ?? false,
      entitlements: parsedEntitlements,
      features,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to save plan.");
  }

  return mapPlanRow(data as unknown as PlanRow);
}

export async function syncAdminPlatformPlanToStripe(planId: string): Promise<{
  stripeProductId: string;
  stripePriceId: string;
}> {
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("platform_subscription_plans")
    .select("*")
    .eq("id", planId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Plan not found.");
  }

  const plan = mapPlanRow(data as unknown as PlanRow);

  if (plan.priceMonthlyCents <= 0) {
    throw new Error("Free plans do not require Stripe prices.");
  }

  const stripe = await getStripeClient();
  let productId = plan.stripeProductId ?? undefined;

  if (!productId) {
    const product = await stripe.products.create({
      name: `OrzuX ${plan.label}`,
      description: plan.tagline || undefined,
      metadata: { plan_id: plan.id, platform: "orzux" },
    });
    productId = product.id;
  } else {
    await stripe.products.update(productId, {
      name: `OrzuX ${plan.label}`,
      description: plan.tagline || undefined,
    });
  }

  const price = await stripe.prices.create({
    product: productId,
    unit_amount: plan.priceMonthlyCents,
    currency: "usd",
    recurring: { interval: "month" },
    metadata: { plan_id: plan.id, platform: "orzux" },
  });

  if (plan.stripePriceId && plan.stripePriceId !== price.id) {
    try {
      await stripe.prices.update(plan.stripePriceId, { active: false });
    } catch {
      // ignore
    }
  }

  await service
    .from("platform_subscription_plans")
    .update({
      stripe_product_id: productId,
      stripe_price_id: price.id,
    })
    .eq("id", plan.id);

  return { stripeProductId: productId, stripePriceId: price.id };
}

export async function syncAllAdminPaidPlansToStripe() {
  const plans = await listAdminPlatformPlans();
  const synced: Array<{ planId: string; stripePriceId: string }> = [];
  const skipped: string[] = [];
  const errors: Array<{ planId: string; message: string }> = [];

  for (const plan of plans) {
    if (plan.priceMonthlyCents <= 0) {
      skipped.push(plan.id);
      continue;
    }

    try {
      const result = await syncAdminPlatformPlanToStripe(plan.id);
      synced.push({ planId: plan.id, stripePriceId: result.stripePriceId });
    } catch (error) {
      errors.push({
        planId: plan.id,
        message: error instanceof Error ? error.message : "Sync failed.",
      });
    }
  }

  return { synced, skipped, errors };
}

export async function listAdminPlatformAddons(): Promise<PlatformSubscriptionAddonRow[]> {
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("platform_subscription_addons")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data as unknown as PlatformSubscriptionAddonRow[];
}

export async function upsertAdminPlatformAddon(input: UpsertPlatformAddonInput) {
  const service = createServiceRoleClient();
  const { error } = await service.from("platform_subscription_addons").upsert({
    id: input.id.trim().toLowerCase(),
    label: input.label.trim(),
    description: input.description?.trim() ?? "",
    price_monthly_cents: input.priceMonthlyCents,
    sort_order: input.sortOrder ?? 0,
    is_active: input.isActive ?? true,
  });

  if (error) {
    throw new Error(error.message);
  }

  return input.id.trim().toLowerCase();
}

export async function syncAdminPlatformAddonToStripe(addonId: string) {
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("platform_subscription_addons")
    .select("*")
    .eq("id", addonId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Add-on not found.");
  }

  const addon = data as unknown as PlatformSubscriptionAddonRow;

  if (addon.price_monthly_cents <= 0) {
    throw new Error("Add-on price must be greater than zero.");
  }

  const stripe = await getStripeClient();
  let productId = addon.stripe_product_id ?? undefined;

  if (!productId) {
    const product = await stripe.products.create({
      name: `OrzuX ${addon.label}`,
      description: addon.description || undefined,
      metadata: { addon_id: addon.id, platform: "orzux" },
    });
    productId = product.id;
  } else {
    await stripe.products.update(productId, {
      name: `OrzuX ${addon.label}`,
      description: addon.description || undefined,
    });
  }

  const price = await stripe.prices.create({
    product: productId,
    unit_amount: addon.price_monthly_cents,
    currency: "usd",
    recurring: { interval: "month" },
    metadata: { addon_id: addon.id, platform: "orzux" },
  });

  if (addon.stripe_price_id && addon.stripe_price_id !== price.id) {
    try {
      await stripe.prices.update(addon.stripe_price_id, { active: false });
    } catch {
      // ignore
    }
  }

  await service
    .from("platform_subscription_addons")
    .update({
      stripe_product_id: productId,
      stripe_price_id: price.id,
    })
    .eq("id", addon.id);

  return { stripeProductId: productId, stripePriceId: price.id };
}

export async function syncAllAdminAddonsToStripe() {
  const addons = await listAdminPlatformAddons();
  const synced: Array<{ addonId: string; stripePriceId: string }> = [];
  const errors: Array<{ addonId: string; message: string }> = [];

  for (const addon of addons) {
    try {
      const result = await syncAdminPlatformAddonToStripe(addon.id);
      synced.push({ addonId: addon.id, stripePriceId: result.stripePriceId });
    } catch (error) {
      errors.push({
        addonId: addon.id,
        message: error instanceof Error ? error.message : "Sync failed.",
      });
    }
  }

  return { synced, errors };
}

export async function loadAdminPlanPrices(): Promise<
  Record<string, { label: string; priceMonthly: number }>
> {
  const plans = await listAdminPlatformPlans();
  return Object.fromEntries(
    plans.map((plan) => [
      plan.id,
      { label: plan.label, priceMonthly: plan.priceMonthly },
    ]),
  );
}
