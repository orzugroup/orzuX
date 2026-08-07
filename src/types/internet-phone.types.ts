export type InternetPhoneConnectionStatus =
  | "pending"
  | "connected"
  | "disconnected";

export type InternetPhoneCallStatus =
  | "started"
  | "ringing"
  | "ai_active"
  | "human_active"
  | "active"
  | "ended"
  | "failed";

export type InternetPhoneCallMode = "ai" | "human" | "handoff";

export type InternetPhoneAiStatus =
  | "pending"
  | "joining"
  | "active"
  | "muted"
  | "left"
  | "failed";

export type InternetPhoneEndedReason =
  | "customer_hangup"
  | "staff_end"
  | "ai_end"
  | "failed"
  | "timeout";

export type InternetPhoneConnectionData = {
  id: string;
  businessId: string;
  publicId: string;
  status: InternetPhoneConnectionStatus;
  displayName: string | null;
  greetingMessage: string;
  primaryColor: string;
  publicUrl: string;
  connectedAt: string | null;
  lastCallAt: string | null;
};

export type InternetPhoneConnectConfig = {
  isConfigured: boolean;
  livekitUrl: string | null;
  agentConfigured: boolean;
};

export type ConnectInternetPhoneResult =
  | { success: true; connection: InternetPhoneConnectionData }
  | {
      success: false;
      error: { code: string; message: string };
    };

export type PublicInternetPhonePageData = {
  publicId: string;
  businessName: string;
  displayName: string;
  greetingMessage: string;
  primaryColor: string;
};

export type InternetPhoneTokenResponse = {
  livekitUrl: string;
  token: string;
  roomName: string;
  callId: string;
  aiStatus: InternetPhoneAiStatus;
};

export type InternetPhoneLiveCall = {
  id: string;
  businessId: string;
  roomName: string;
  visitorId: string;
  status: InternetPhoneCallStatus;
  callMode: InternetPhoneCallMode;
  aiStatus: InternetPhoneAiStatus;
  humanHandled: boolean;
  staffRequested: boolean;
  contactId: string | null;
  conversationId: string | null;
  operatorUserId: string | null;
  startedAt: string;
  endedAt: string | null;
  handoffAt: string | null;
  staffRequestedAt: string | null;
};

export type InternetPhoneStaffTokenResponse = {
  livekitUrl: string;
  token: string;
  roomName: string;
  callId: string;
  mode: "listen" | "talk";
  identity: string;
};
