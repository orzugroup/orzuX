export function toInternetPhoneCallKey(callId: string): string {
  return `inetphone:${callId.trim()}`;
}

export function isInternetPhoneCallKey(callSid: string): boolean {
  return callSid.trim().startsWith("inetphone:");
}

export function parseInternetPhoneCallId(callSid: string): string | null {
  const trimmed = callSid.trim();
  if (!trimmed.startsWith("inetphone:")) return null;
  const callId = trimmed.slice("inetphone:".length).trim();
  return callId || null;
}
