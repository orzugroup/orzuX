import "server-only";

import { cache } from "react";
import { revalidatePath } from "next/cache";

import { APP_ROUTES, DASHBOARD_ROUTES } from "@/constants/routes";
import {
  BUSINESS_LOGOS_BUCKET,
  BUSINESS_MESSAGES,
  DEFAULT_AI_LANGUAGE,
  DEFAULT_AI_SYSTEM_PROMPT,
} from "@/features/business/constants";
import { DEFAULT_COMMUNICATION_STYLE } from "@/features/ai-assistant/communication-styles";
import { getDefaultGeminiModel } from "@/lib/env.schema";
import { hasSupabaseEnv } from "@/lib/env";
import {
  getR2PublicMediaBaseUrl,
  getR2PublicUrl,
  isR2Configured,
  r2DeleteObject,
  r2PutObject,
} from "@/lib/storage/r2";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/services/auth.service";
import { getTrialEndsAt } from "@/services/trial.service";
import type {
  BusinessPayload,
  CreateBusinessResult,
  UpdateBusinessResult,
  UploadBusinessLogoResult,
} from "@/types/business.types";
import {
  ALLOWED_BUSINESS_LOGO_TYPES,
  MAX_BUSINESS_LOGO_SIZE_BYTES,
  createBusinessSchema,
  updateBusinessSchema,
} from "@/types/business.types";
import type { Business } from "@/types/database.types";
import {
  buildBusinessLogoPath,
  emptyStringToNull,
  getBusinessLogoExtension,
  mapBusinessToProfile,
} from "@/utils/business";
import { sendBusinessEmailRegisteredNotification } from "@/services/business-email-notification.service";

function missingConfigError(): {
  success: false;
  error: { code: "MISSING_CONFIG"; message: string };
} {
  return {
    success: false,
    error: {
      code: "MISSING_CONFIG",
      message: BUSINESS_MESSAGES.missingConfig,
    },
  };
}

function revalidateBusinessPaths(): void {
  revalidatePath(APP_ROUTES.dashboard);
  revalidatePath(DASHBOARD_ROUTES.settings);
}

const MESSAGING_CHANNELS = [
  "whatsapp",
  "instagram",
  "telegram",
  "website_forms",
] as const;

async function bootstrapBusinessDefaults(businessId: string): Promise<void> {
  const supabase = await createClient();

  await supabase.from("analytics").upsert(
    {
      business_id: businessId,
      total_messages: 0,
      total_contacts: 0,
      ai_replies: 0,
    },
    { onConflict: "business_id" },
  );

  for (const channel of MESSAGING_CHANNELS) {
    await Promise.all([
      supabase.from("channel_analytics").upsert(
        {
          business_id: businessId,
          channel,
          total_messages: 0,
          total_contacts: 0,
          ai_replies: 0,
        },
        { onConflict: "business_id,channel" },
      ),
      supabase.from("ai_settings").upsert(
        {
          business_id: businessId,
          channel,
          provider: "gemini",
          model: getDefaultGeminiModel(),
          language: DEFAULT_AI_LANGUAGE,
          system_prompt: DEFAULT_AI_SYSTEM_PROMPT,
          ai_enabled: false,
        },
        { onConflict: "business_id,channel" },
      ),
    ]);
  }

  await supabase.from("ai_assistant_profile").upsert(
    {
      business_id: businessId,
      name: "AI Assistant",
      system_prompt: DEFAULT_AI_SYSTEM_PROMPT,
      communication_style: DEFAULT_COMMUNICATION_STYLE,
      language: DEFAULT_AI_LANGUAGE,
    },
    { onConflict: "business_id" },
  );
}

function mapPayloadToRow(payload: BusinessPayload) {
  return {
    business_name: payload.businessName,
    business_description: emptyStringToNull(payload.businessDescription),
    business_sector: emptyStringToNull(payload.businessSector),
    business_sector_custom:
      payload.businessSector === "other"
        ? emptyStringToNull(payload.businessSectorCustom)
        : null,
    business_type: emptyStringToNull(payload.businessType),
    business_type_custom:
      payload.businessType === "other"
        ? emptyStringToNull(payload.businessTypeCustom)
        : null,
    phone: emptyStringToNull(payload.phone),
    email: emptyStringToNull(payload.email),
    address: emptyStringToNull(payload.address),
    website: emptyStringToNull(payload.website),
  };
}

export const getPrimaryBusiness = cache(async function getPrimaryBusiness(
  userId: string,
): Promise<Business | null> {
  if (!hasSupabaseEnv()) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
});

export async function createBusiness(
  input: BusinessPayload,
): Promise<CreateBusinessResult> {
  if (!hasSupabaseEnv()) {
    return missingConfigError();
  }

  const parsed = createBusinessSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid input.",
      },
    };
  }

  const user = await requireUser();
  const existingBusiness = await getPrimaryBusiness(user.id);

  if (existingBusiness) {
    return {
      success: false,
      error: {
        code: "ALREADY_EXISTS",
        message: BUSINESS_MESSAGES.alreadyExists,
      },
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("businesses")
    .insert({
      user_id: user.id,
      subscription_plan: "free",
      subscription_status: "trialing",
      trial_ends_at: getTrialEndsAt(),
      ...mapPayloadToRow(parsed.data),
    })
    .select("*")
    .single();

  if (error || !data) {
    return {
      success: false,
      error: {
        code: "CREATE_FAILED",
        message: error?.message || BUSINESS_MESSAGES.genericError,
      },
    };
  }

  await bootstrapBusinessDefaults(data.id);
  revalidateBusinessPaths();

  if (parsed.data.email.trim()) {
    void sendBusinessEmailRegisteredNotification({
      businessId: data.id,
      businessName: parsed.data.businessName,
      businessEmail: parsed.data.email,
    });
  }

  return {
    success: true,
    data: mapBusinessToProfile(data),
  };
}

export async function updateBusiness(
  businessId: string,
  input: BusinessPayload,
): Promise<UpdateBusinessResult> {
  if (!hasSupabaseEnv()) {
    return missingConfigError();
  }

  const parsed = updateBusinessSchema.safeParse({
    businessId,
    ...input,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid input.",
      },
    };
  }

  const user = await requireUser();
  const existingBusiness = await getPrimaryBusiness(user.id);

  if (!existingBusiness || existingBusiness.id !== businessId) {
    return {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: BUSINESS_MESSAGES.notFound,
      },
    };
  }

  const supabase = await createClient();
  const previousEmail = existingBusiness.email?.trim().toLowerCase() ?? "";
  const { data, error } = await supabase
    .from("businesses")
    .update(mapPayloadToRow(parsed.data))
    .eq("id", businessId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    return {
      success: false,
      error: {
        code: "UPDATE_FAILED",
        message: error?.message || BUSINESS_MESSAGES.genericError,
      },
    };
  }

  revalidateBusinessPaths();

  const nextEmail = parsed.data.email.trim().toLowerCase();
  if (nextEmail.includes("@") && nextEmail !== previousEmail) {
    void sendBusinessEmailRegisteredNotification({
      businessId: data.id,
      businessName: parsed.data.businessName,
      businessEmail: parsed.data.email,
    });
  }

  return {
    success: true,
    data: mapBusinessToProfile(data),
  };
}

function isAllowedLogoType(type: string): boolean {
  return ALLOWED_BUSINESS_LOGO_TYPES.includes(
    type as (typeof ALLOWED_BUSINESS_LOGO_TYPES)[number],
  );
}

async function removeExistingLogo(storagePath: string | null): Promise<void> {
  if (!storagePath) {
    return;
  }

  const supabase = await createClient();
  await supabase.storage.from(BUSINESS_LOGOS_BUCKET).remove([storagePath]);
}

export async function uploadBusinessLogo(
  businessId: string,
  file: File,
): Promise<UploadBusinessLogoResult> {
  if (!hasSupabaseEnv()) {
    return missingConfigError();
  }

  if (!isAllowedLogoType(file.type)) {
    return {
      success: false,
      error: {
        code: "LOGO_INVALID",
        message: BUSINESS_MESSAGES.logoInvalidType,
      },
    };
  }

  if (file.size > MAX_BUSINESS_LOGO_SIZE_BYTES) {
    return {
      success: false,
      error: {
        code: "LOGO_INVALID",
        message: BUSINESS_MESSAGES.logoTooLarge,
      },
    };
  }

  const user = await requireUser();
  const existingBusiness = await getPrimaryBusiness(user.id);

  if (!existingBusiness || existingBusiness.id !== businessId) {
    return {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: BUSINESS_MESSAGES.notFound,
      },
    };
  }

  const extension = getBusinessLogoExtension(file.type);
  const storagePath = buildBusinessLogoPath(user.id, businessId, extension);
  const supabase = await createClient();
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  // Public assets (logos) go to Cloudflare R2 via a public domain when configured;
  // otherwise fall back to Supabase Storage (backward compatible).
  const r2PublicBase = getR2PublicMediaBaseUrl();
  const useR2Logo = isR2Configured() && Boolean(r2PublicBase);
  const r2LogoKey = `business-logos/${storagePath}`;

  if (useR2Logo) {
    const ok = await r2PutObject({
      bucket: "media",
      key: r2LogoKey,
      body: fileBuffer,
      contentType: file.type,
    });

    if (!ok) {
      return {
        success: false,
        error: {
          code: "LOGO_UPLOAD_FAILED",
          message: BUSINESS_MESSAGES.logoGenericError,
        },
      };
    }
  } else {
    const { error: uploadError } = await supabase.storage
      .from(BUSINESS_LOGOS_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: true,
        cacheControl: "3600",
      });

    if (uploadError) {
      return {
        success: false,
        error: {
          code: "LOGO_UPLOAD_FAILED",
          message: uploadError.message || BUSINESS_MESSAGES.logoGenericError,
        },
      };
    }
  }

  const publicUrl = useR2Logo
    ? getR2PublicUrl(r2LogoKey)!
    : supabase.storage.from(BUSINESS_LOGOS_BUCKET).getPublicUrl(storagePath).data
        .publicUrl;

  const logoUrl = `${publicUrl}?v=${Date.now()}`;

  const { data, error: updateError } = await supabase
    .from("businesses")
    .update({ logo_url: logoUrl })
    .eq("id", businessId)
    .eq("user_id", user.id)
    .select("logo_url")
    .single();

  if (updateError || !data?.logo_url) {
    if (useR2Logo) {
      await r2DeleteObject({ bucket: "media", key: r2LogoKey });
    } else {
      await removeExistingLogo(storagePath);
    }

    return {
      success: false,
      error: {
        code: "LOGO_UPLOAD_FAILED",
        message: updateError?.message || BUSINESS_MESSAGES.logoGenericError,
      },
    };
  }

  revalidateBusinessPaths();

  return {
    success: true,
    data: {
      logoUrl: data.logo_url,
    },
  };
}
