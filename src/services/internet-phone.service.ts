import "server-only";

import { randomBytes } from "node:crypto";

import { ENV_KEYS } from "@/constants/env-keys";
import {
  INTERNET_PHONE_DEFAULTS,
  INTERNET_PHONE_MESSAGES,
} from "@/features/internet-phone/constants";
import { hasLiveKitEnv } from "@/lib/livekit/config";
import { createInternetPhoneParticipantToken } from "@/lib/livekit/token";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/env";
import { resolveInboundMessageContext } from "@/services/inbound-ingest.service";
import { assertCanConnectIntegration } from "@/services/entitlement.service";
import { getCurrentUser } from "@/services/auth.service";
import { getPrimaryBusiness } from "@/services/business.service";
import type {
  ConnectInternetPhoneResult,
  InternetPhoneConnectConfig,
  InternetPhoneConnectionData,
  InternetPhoneConnectionStatus,
  InternetPhoneTokenResponse,
  PublicInternetPhonePageData,
} from "@/types/internet-phone.types";
import type { WebsiteFormStatus } from "@/types/database.types";

type InternetPhoneConnectionRow = {
  id: string;
  business_id: string;
  public_id: string;
  connection_status: WebsiteFormStatus;
  display_name: string | null;
  greeting_message: string;
  primary_color: string;
  connected_at: string | null;
  last_call_at: string | null;
};

function getAppBaseUrl(): string {
  return (
    process.env[ENV_KEYS.NEXT_PUBLIC_APP_URL]?.trim().replace(/\/$/, "") ||
    "https://www.orzux.com"
  );
}

function generatePublicId(): string {
  return randomBytes(9).toString("base64url");
}

function mapStatus(status: WebsiteFormStatus): InternetPhoneConnectionStatus {
  if (status === "connected") return "connected";
  if (status === "disconnected") return "disconnected";
  return "pending";
}

function mapConnection(row: InternetPhoneConnectionRow): InternetPhoneConnectionData {
  return {
    id: row.id,
    businessId: row.business_id,
    publicId: row.public_id,
    status: mapStatus(row.connection_status),
    displayName: row.display_name,
    greetingMessage: row.greeting_message,
    primaryColor: row.primary_color,
    publicUrl: `${getAppBaseUrl()}/call/${row.public_id}`,
    connectedAt: row.connected_at,
    lastCallAt: row.last_call_at,
  };
}

async function getOwnedBusinessId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const business = await getPrimaryBusiness(user.id);
  return business?.id ?? null;
}

export function getInternetPhoneConnectConfig(): InternetPhoneConnectConfig {
  return {
    isConfigured: hasLiveKitEnv(),
    livekitUrl: process.env[ENV_KEYS.LIVEKIT_URL]?.trim() || null,
  };
}

export async function getInternetPhoneConnection(
  businessId: string,
): Promise<InternetPhoneConnectionData | null> {
  if (!hasSupabaseEnv()) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("internet_phone_connections")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  if (!data) return null;
  return mapConnection(data as InternetPhoneConnectionRow);
}

export async function connectInternetPhone(): Promise<ConnectInternetPhoneResult> {
  if (!hasSupabaseEnv()) {
    return {
      success: false,
      error: { code: "MISSING_CONFIG", message: INTERNET_PHONE_MESSAGES.notConfigured },
    };
  }

  const config = getInternetPhoneConnectConfig();
  if (!config.isConfigured) {
    return {
      success: false,
      error: { code: "MISSING_CONFIG", message: INTERNET_PHONE_MESSAGES.notConfigured },
    };
  }

  const businessId = await getOwnedBusinessId();
  if (!businessId) {
    return {
      success: false,
      error: {
        code: "NO_BUSINESS",
        message: INTERNET_PHONE_MESSAGES.noBusinessDescription,
      },
    };
  }

  const entitlement = await assertCanConnectIntegration(
    businessId,
    "internet_phone",
  );
  if (!entitlement.allowed) {
    return {
      success: false,
      error: { code: "NOT_ALLOWED", message: entitlement.message },
    };
  }

  const user = await getCurrentUser();
  const business = user ? await getPrimaryBusiness(user.id) : null;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("internet_phone_connections")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  const now = new Date().toISOString();
  const existingRow = existing as InternetPhoneConnectionRow | null;
  const publicId = existingRow?.public_id ?? generatePublicId();

  const { data, error } = await supabase
    .from("internet_phone_connections")
    .upsert(
      {
        business_id: businessId,
        public_id: publicId,
        connection_status: "connected",
        display_name:
          existingRow?.display_name ?? business?.business_name ?? null,
        greeting_message:
          existingRow?.greeting_message ?? INTERNET_PHONE_DEFAULTS.greetingMessage,
        primary_color:
          existingRow?.primary_color ?? INTERNET_PHONE_DEFAULTS.primaryColor,
        connected_at: existingRow?.connected_at ?? now,
      },
      { onConflict: "business_id" },
    )
    .select("*")
    .single();

  if (error || !data) {
    return {
      success: false,
      error: {
        code: "CONNECT_FAILED",
        message: error?.message || INTERNET_PHONE_MESSAGES.connectFailed,
      },
    };
  }

  return {
    success: true,
    connection: mapConnection(data as InternetPhoneConnectionRow),
  };
}

export async function disconnectInternetPhone(): Promise<ConnectInternetPhoneResult> {
  const businessId = await getOwnedBusinessId();
  if (!businessId) {
    return {
      success: false,
      error: {
        code: "NO_BUSINESS",
        message: INTERNET_PHONE_MESSAGES.noBusinessDescription,
      },
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("internet_phone_connections")
    .update({ connection_status: "disconnected" })
    .eq("business_id", businessId)
    .select("*")
    .maybeSingle();

  if (error) {
    return {
      success: false,
      error: {
        code: "DISCONNECT_FAILED",
        message: error.message || INTERNET_PHONE_MESSAGES.disconnectFailed,
      },
    };
  }

  if (!data) {
    return {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: INTERNET_PHONE_MESSAGES.disconnectFailed,
      },
    };
  }

  return {
    success: true,
    connection: mapConnection(data as InternetPhoneConnectionRow),
  };
}

export async function getPublicInternetPhonePage(
  publicId: string,
): Promise<PublicInternetPhonePageData | null> {
  if (!hasSupabaseEnv() || !publicId.trim()) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("internet_phone_connections")
    .select(
      "public_id, display_name, greeting_message, primary_color, connection_status, business_id",
    )
    .eq("public_id", publicId.trim())
    .eq("connection_status", "connected")
    .maybeSingle();

  if (!data) return null;

  const row = data as InternetPhoneConnectionRow;
  const { data: business } = await supabase
    .from("businesses")
    .select("business_name")
    .eq("id", row.business_id)
    .maybeSingle();

  const businessName =
    business?.business_name?.trim() || row.display_name?.trim() || "Business";

  return {
    publicId: row.public_id,
    businessName,
    displayName: row.display_name?.trim() || businessName,
    greetingMessage:
      row.greeting_message?.trim() || INTERNET_PHONE_DEFAULTS.greetingMessage,
    primaryColor: row.primary_color || INTERNET_PHONE_DEFAULTS.primaryColor,
  };
}

export async function startPublicInternetPhoneCall(input: {
  publicId: string;
  visitorId: string;
}): Promise<
  | { success: true; data: InternetPhoneTokenResponse }
  | { success: false; error: string; status: number }
> {
  if (!hasSupabaseEnv()) {
    return { success: false, error: "Not configured", status: 503 };
  }

  const visitorId = input.visitorId.trim().slice(0, 64);
  if (!visitorId) {
    return { success: false, error: "Missing visitor id", status: 400 };
  }

  const supabase = createAdminClient();
  const { data: connection } = await supabase
    .from("internet_phone_connections")
    .select("*")
    .eq("public_id", input.publicId.trim())
    .eq("connection_status", "connected")
    .maybeSingle();

  if (!connection) {
    return { success: false, error: "Internet Phone not found", status: 404 };
  }

  const row = connection as InternetPhoneConnectionRow;
  const roomName = `inetphone_${row.public_id}_${randomBytes(6).toString("hex")}`;
  const tokenPayload = await createInternetPhoneParticipantToken({
    identity: `visitor_${visitorId}`,
    roomName,
    displayName: "Caller",
  });

  if (!tokenPayload) {
    return {
      success: false,
      error: INTERNET_PHONE_MESSAGES.notConfigured,
      status: 503,
    };
  }

  const contactPhone = `inet:${row.public_id}:${visitorId}`;
  const ingest = await resolveInboundMessageContext(supabase, {
    businessId: row.business_id,
    channel: "internet_phone",
    contactName: "Internet Phone caller",
    contactPhone,
    identifier: contactPhone,
    displayLabel: "Internet Phone caller",
  });

  const { data: callRow, error: callError } = await supabase
    .from("internet_phone_calls")
    .insert({
      business_id: row.business_id,
      connection_id: row.id,
      room_name: roomName,
      visitor_id: visitorId,
      status: "started",
      contact_id: ingest?.contactId ?? null,
      conversation_id: ingest?.conversationId ?? null,
    })
    .select("id")
    .single();

  if (callError || !callRow) {
    return {
      success: false,
      error: callError?.message || "Unable to start call",
      status: 500,
    };
  }

  await supabase
    .from("internet_phone_connections")
    .update({ last_call_at: new Date().toISOString() })
    .eq("id", row.id);

  return {
    success: true,
    data: {
      livekitUrl: tokenPayload.livekitUrl,
      token: tokenPayload.token,
      roomName,
      callId: callRow.id as string,
    },
  };
}
