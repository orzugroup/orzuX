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
  liveCallsTitle: "Live browser calls",
  liveCallsEmpty: "No active Internet Phone calls right now.",
  listenIn: "Listen",
  takeOver: "Take over",
  endCall: "End call",
  leaveCall: "Leave",
  staffConnecting: "Joining call…",
  staffListening: "Listening — AI is speaking with the customer",
  staffTalking: "You’re on the call — AI is muted",
  aiConnecting: "Connecting you to our assistant…",
  aiLive: "Connected with AI assistant",
  humanLive: "Connected with a team member",
  handoffSuccess: "You took over the call. AI is muted.",
  handoffFailed: "Unable to take over this call.",
  staffTokenFailed: "Unable to join this call.",
  endCallFailed: "Unable to end this call.",
  agentNotConfigured:
    "AI agent worker is not configured (LIVEKIT_AGENT_URL). Customers can still join the room.",
} as const;

export const INTERNET_PHONE_DEFAULTS = {
  greetingMessage: "Tap Call to speak with us in your browser.",
  primaryColor: "#0F766E",
} as const;

export const INTERNET_PHONE_DATA_TOPICS = {
  handoff: "orzu.internet_phone.handoff",
  end: "orzu.internet_phone.end",
  aiMuted: "orzu.internet_phone.ai_muted",
} as const;
