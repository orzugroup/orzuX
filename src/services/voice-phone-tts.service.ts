import "server-only";

import { randomUUID } from "crypto";

import { hasSupabaseEnv } from "@/lib/env";
import { resolveElevenLabsLanguageCode } from "@/lib/voice/language";
import { newMediaObjectRef, putMediaObject } from "@/lib/storage/media-storage";
import { getChatAttachmentSignedUrl } from "@/services/chat-attachment-signed-url.service";
import {
  hasElevenLabsConfigured,
  synthesizeElevenLabsSpeech,
} from "@/services/elevenlabs.service";
import { logAiUsage } from "@/services/ai-usage.service";
import { getVoiceRepository } from "@/repositories/voice.repository";
import { getVoiceAgentSettings } from "@/services/voice-config.service";

const PHONE_TTS_MODEL = "eleven_turbo_v2_5";
const SIGNED_URL_TTL_SECONDS = 60 * 60;
/** Fallback when a business has not picked an ElevenLabs voice yet. */
const DEFAULT_PHONE_VOICE_ID =
  process.env.DEFAULT_ELEVENLABS_VOICE_ID?.trim() || "EXAVITQu4vr4xnSDxMaL";

export type PhoneVoiceSettings = {
  useElevenLabs: boolean;
  voiceId: string | null;
  language: string;
  languageCode: string | undefined;
};

export async function loadPhoneVoiceSettings(
  businessId: string,
): Promise<PhoneVoiceSettings> {
  const [voiceSettings, profileResult] = await Promise.all([
    getVoiceAgentSettings(businessId),
    hasSupabaseEnv()
      ? getVoiceRepository().client
          .from("ai_assistant_profile")
          .select(
            "voice_reply_enabled, elevenlabs_voice_id, language",
          )
          .eq("business_id", businessId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const profile = profileResult.data;
  const configuredVoiceId = profile?.elevenlabs_voice_id?.trim() || null;
  const voiceId = configuredVoiceId || DEFAULT_PHONE_VOICE_ID;
  const language =
    profile?.language?.trim() ||
    voiceSettings.voiceLanguage?.trim() ||
    "English";

  return {
    useElevenLabs: Boolean(voiceId && hasElevenLabsConfigured()),
    voiceId,
    language,
    languageCode: resolveElevenLabsLanguageCode(language),
  };
}

async function uploadPhoneTtsAudio(input: {
  businessId: string;
  callSid: string;
  buffer: Buffer;
  fileName: string;
}): Promise<string | null> {
  if (!hasSupabaseEnv()) {
    return null;
  }

  const logicalKey = `voice-phone-tts/${input.businessId}/${input.callSid}/${input.fileName}`;
  const ref = newMediaObjectRef(logicalKey);

  const ok = await putMediaObject({
    ref,
    body: input.buffer,
    contentType: "audio/mpeg",
    upsert: true,
  });

  if (!ok) {
    console.error("[voice-phone-tts] upload failed for ref:", ref);
    return null;
  }

  return getChatAttachmentSignedUrl(ref, SIGNED_URL_TTL_SECONDS);
}

export async function synthesizePhoneSpeechAudio(input: {
  businessId: string;
  callSid: string;
  text: string;
  turnKey?: string;
}): Promise<
  { success: true; audioUrl: string } | { success: false; message: string }
> {
  const speech = input.text.trim();

  if (!speech) {
    return { success: false, message: "Text is empty." };
  }

  const phoneVoice = await loadPhoneVoiceSettings(input.businessId);

  if (!phoneVoice.useElevenLabs || !phoneVoice.voiceId) {
    return {
      success: false,
      message: "ElevenLabs phone voice is not configured.",
    };
  }

  const synthesis = await synthesizeElevenLabsSpeech({
    text: speech,
    voiceId: phoneVoice.voiceId,
    languageCode: phoneVoice.languageCode,
    modelId: PHONE_TTS_MODEL,
  });

  if (!synthesis.success) {
    return synthesis;
  }

  const fileName = `${input.turnKey ?? randomUUID()}.mp3`;
  const audioUrl = await uploadPhoneTtsAudio({
    businessId: input.businessId,
    callSid: input.callSid,
    buffer: synthesis.buffer,
    fileName,
  });

  if (!audioUrl) {
    return { success: false, message: "Unable to store phone speech audio." };
  }

  void logAiUsage({
    businessId: input.businessId,
    provider: "elevenlabs",
    model: PHONE_TTS_MODEL,
    inputTokens: speech.length,
    outputTokens: 0,
    billingSource: "platform",
    callType: "voice_tts",
  });

  return { success: true, audioUrl };
}
