export const INTERNET_PHONE_MESSAGES = {
  notConfigured:
    "Internet Phone is not configured yet. Add LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET on the server.",
  noBusinessDescription: "Create a business workspace before connecting Internet Phone.",
  connectSuccess: "Internet Phone connected. Share your link, QR, or PDF.",
  connectFailed: "Unable to connect Internet Phone. Please try again.",
  disconnectSuccess: "Internet Phone disconnected.",
  disconnectFailed: "Unable to disconnect Internet Phone.",
  pageTitle: "Internet Phone",
  pageDescription:
    "Browser-based calls via your public link and QR code — no app install for customers.",
  publicUnavailable: "This Internet Phone is unavailable.",
  callButton: "Call",
  calling: "Connecting…",
  micDenied: "Microphone access is required to place a call.",
  callEnded: "Call ended.",
  downloadPdf: "Download PDF (A5)",
  copyLink: "Public call link",
} as const;

export const INTERNET_PHONE_DEFAULTS = {
  greetingMessage: "Tap Call to speak with us in your browser.",
  primaryColor: "#0F766E",
} as const;
