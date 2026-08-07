export type InternetPhoneConnectionStatus =
  | "pending"
  | "connected"
  | "disconnected";

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
};
