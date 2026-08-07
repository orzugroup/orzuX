import "server-only";

import { hasSupabaseEnv } from "@/lib/env";
import {
  getVoicePhonePrompts,
  resolveDeepgramLanguageCode,
} from "@/lib/voice/language";
import {
  getVoiceRepository,
  type VoiceCallSessionTurn,
} from "@/repositories/voice.repository";
import { getVoiceAgentSettings } from "@/services/voice-config.service";
import {
  generateVoiceAiReply,
  generateVoiceAiReplyStream,
  generateVoiceOpeningLine,
  buildVoiceStreamLlmConfig,
  type VoiceAiStreamChunk,
} from "@/services/voice-ai.service";
import {
  markInboundCallAiFallback,
  markVoiceCallCompleted,
} from "@/services/voice-inbox.service";
import {
  loadPhoneVoiceSettings,
} from "@/services/voice-phone-tts.service";
import { scheduleVoiceTurnOrchestration } from "@/services/voice-orchestrator.service";
import { getVoiceAiBusinessContext } from "@/repositories/business-context.repository";

const MAX_STREAM_TURNS = 24;

function resolveStreamOpeningLine(input: {
  settings: Awaited<ReturnType<typeof getVoiceAgentSettings>>;
  direction: "inbound" | "outbound";
  language: string;
}) {
  const prompts = getVoicePhonePrompts(input.language);
  const configuredLine =
    input.direction === "inbound"
      ? input.settings.inboundGreeting?.trim()
      : input.settings.outboundScript?.trim();

  const defaultEnglishInbound =
    "Thank you for calling. How can we help you today?";
  const defaultEnglishOutbound =
    "Hello! This is your AI assistant calling to confirm your order and see if you have any questions.";

  if (
    configuredLine &&
    configuredLine !== defaultEnglishInbound &&
    configuredLine !== defaultEnglishOutbound
  ) {
    return configuredLine;
  }

  return input.direction === "inbound"
    ? prompts.inboundReprompt
    : prompts.outboundReprompt;
}

async function getOrCreateStreamSession(input: {
  businessId: string;
  callSid: string;
  direction: "inbound" | "outbound";
}) {
  const repo = getVoiceRepository();
  const existing = await repo.findSessionByCallSid(input.callSid);

  if (existing) {
    return {
      ...existing,
      turns: (existing.turns as VoiceCallSessionTurn[]) ?? [],
    };
  }

  const created = await repo.createSession({
    businessId: input.businessId,
    callSid: input.callSid,
    direction: input.direction,
  });

  if (!created) {
    return null;
  }

  return {
    ...created,
    turns: [] as VoiceCallSessionTurn[],
  };
}

function normalizeCallerPhone(phoneNumber?: string | null): string | null {
  const normalized = phoneNumber?.trim();

  if (!normalized || normalized === "stream" || normalized === "unknown") {
    return null;
  }

  return normalized;
}

function scheduleVoiceStreamOrchestration(input: {
  businessId: string;
  callSid: string;
  callerPhone?: string | null;
  clientMessage: string;
  conversationHistory: VoiceCallSessionTurn[];
}): void {
  const callerPhone = normalizeCallerPhone(input.callerPhone);

  if (callerPhone) {
    void scheduleVoiceTurnOrchestration({
      businessId: input.businessId,
      callerPhone,
      callSid: input.callSid,
      clientMessage: input.clientMessage,
      conversationHistory: input.conversationHistory,
    });
    return;
  }

  void (async () => {
    const callLog = await getVoiceRepository().findCallLogByExternalCallId(
      input.callSid,
    );
    const resolvedPhone = normalizeCallerPhone(callLog?.phone_number);

    if (!resolvedPhone) {
      return;
    }

    await scheduleVoiceTurnOrchestration({
      businessId: input.businessId,
      callerPhone: resolvedPhone,
      callSid: input.callSid,
      clientMessage: input.clientMessage,
      conversationHistory: input.conversationHistory,
    });
  })().catch((error) => {
    console.warn(
      "[voice-stream] background orchestration failed",
      JSON.stringify({
        businessId: input.businessId,
        callSid: input.callSid,
        error: error instanceof Error ? error.message : "unknown",
      }),
    );
  });
}

export async function getVoiceStreamSessionContext(input: {
  businessId: string;
  callSid: string;
  direction: "inbound" | "outbound";
  triggerReason?: string | null;
}) {
  const [settings, phoneVoice, businessContext, callLog] = await Promise.all([
    getVoiceAgentSettings(input.businessId),
    loadPhoneVoiceSettings(input.businessId),
    getVoiceAiBusinessContext(input.businessId),
    getVoiceRepository().findCallLogByExternalCallId(input.callSid),
  ]);

  if (!phoneVoice.voiceId) {
    throw new Error("ElevenLabs voice is not configured.");
  }

  const prompts = getVoicePhonePrompts(phoneVoice.language);
  const callObjective = callLog?.custom_prompt?.trim() || null;

  let openingLine = resolveStreamOpeningLine({
    settings,
    direction: input.direction,
    language: phoneVoice.language,
  });

  if (callObjective) {
    const generatedOpening = await generateVoiceOpeningLine({
      businessId: input.businessId,
      direction: input.direction,
      callObjective,
      settings,
      triggerReason: input.triggerReason,
    });

    if (generatedOpening) {
      openingLine = generatedOpening;
    }
  }

  const llmConfig = await buildVoiceStreamLlmConfig({
    businessId: input.businessId,
    direction: input.direction,
    triggerReason: input.triggerReason,
    settings,
    callObjective,
    callerPhone: callLog?.phone_number,
  });

  return {
    businessId: input.businessId,
    businessName: businessContext.businessName,
    language: phoneVoice.language,
    languageCode: phoneVoice.languageCode,
    voiceId: phoneVoice.voiceId,
    openingLine,
    errorPrompt: prompts.error,
    repeatPrompt: prompts.repeat,
    direction: input.direction,
    triggerReason: input.triggerReason ?? null,
    deepgramLanguage: resolveDeepgramLanguageCode(phoneVoice.language),
    callObjective,
    systemPrompt: llmConfig.systemPrompt,
    llmModel: llmConfig.llmModel,
    llmProvider: llmConfig.llmProvider,
    openaiApiKey: llmConfig.openaiApiKey,
  };
}

export async function generateVoiceStreamReply(input: {
  businessId: string;
  callSid: string;
  direction: "inbound" | "outbound";
  userMessage: string;
  triggerReason?: string | null;
}): Promise<{ text: string; endCall?: boolean }> {
  const [settings, phoneVoice, callLog, session] = await Promise.all([
    getVoiceAgentSettings(input.businessId),
    loadPhoneVoiceSettings(input.businessId),
    getVoiceRepository().findCallLogByExternalCallId(input.callSid),
    getOrCreateStreamSession({
      businessId: input.businessId,
      callSid: input.callSid,
      direction: input.direction,
    }),
  ]);
  const prompts = getVoicePhonePrompts(phoneVoice.language);

  if (!session) {
    return { text: prompts.error, endCall: true };
  }

  if (session.turn_count >= MAX_STREAM_TURNS) {
    return { text: prompts.goodbye, endCall: true };
  }

  const reply = await generateVoiceAiReply({
    businessId: input.businessId,
    userMessage: input.userMessage,
    conversationHistory: session.turns,
    direction: input.direction,
    triggerReason: input.triggerReason,
    settings,
    callObjective: callLog?.custom_prompt,
    callerPhone: callLog?.phone_number,
  });

  if (!reply.success) {
    console.error(
      "[voice-stream] LLM reply failed",
      JSON.stringify({
        businessId: input.businessId,
        callSid: input.callSid,
        message: reply.message,
        hasCustomPrompt: Boolean(callLog?.custom_prompt?.trim()),
      }),
    );
  }

  const assistantText = reply.success
    ? reply.text
    : "Sorry, I could not process that right now.";

  const turnAt = new Date().toISOString();
  const updatedTurns: VoiceCallSessionTurn[] = [
    ...session.turns,
    { role: "user", content: input.userMessage.trim(), at: turnAt },
    { role: "assistant", content: assistantText, at: turnAt },
  ];

  await getVoiceRepository().updateSessionTurns({
    sessionId: session.id,
    turns: updatedTurns,
    turnCount: session.turn_count + 1,
  });

  scheduleVoiceStreamOrchestration({
    businessId: input.businessId,
    callSid: input.callSid,
    callerPhone: callLog?.phone_number,
    clientMessage: input.userMessage,
    conversationHistory: updatedTurns,
  });

  return {
    text: assistantText,
    endCall: session.turn_count + 1 >= MAX_STREAM_TURNS,
  };
}

export type VoiceStreamReplyStreamEvent =
  | VoiceAiStreamChunk
  | { type: "done"; text: string; endCall?: boolean };

export async function* generateVoiceStreamReplyStream(input: {
  businessId: string;
  callSid: string;
  direction: "inbound" | "outbound";
  userMessage: string;
  triggerReason?: string | null;
}): AsyncGenerator<VoiceStreamReplyStreamEvent, void, void> {
  const [settings, phoneVoice, callLog, session] = await Promise.all([
    getVoiceAgentSettings(input.businessId),
    loadPhoneVoiceSettings(input.businessId),
    getVoiceRepository().findCallLogByExternalCallId(input.callSid),
    getOrCreateStreamSession({
      businessId: input.businessId,
      callSid: input.callSid,
      direction: input.direction,
    }),
  ]);
  const prompts = getVoicePhonePrompts(phoneVoice.language);

  if (!session) {
    yield { type: "delta", text: prompts.error };
    yield { type: "done", text: prompts.error, endCall: true };
    return;
  }

  if (session.turn_count >= MAX_STREAM_TURNS) {
    yield { type: "delta", text: prompts.goodbye };
    yield { type: "done", text: prompts.goodbye, endCall: true };
    return;
  }

  let assistantText = "";

  try {
    for await (const chunk of generateVoiceAiReplyStream({
      businessId: input.businessId,
      userMessage: input.userMessage,
      conversationHistory: session.turns,
      direction: input.direction,
      triggerReason: input.triggerReason,
      settings,
      callObjective: callLog?.custom_prompt,
      callerPhone: callLog?.phone_number,
    })) {
      if (chunk.type === "delta") {
        yield chunk;
      } else {
        assistantText = chunk.text;
      }
    }
  } catch (error) {
    console.error(
      "[voice-stream] LLM stream failed",
      JSON.stringify({
        businessId: input.businessId,
        callSid: input.callSid,
        message: error instanceof Error ? error.message : "unknown",
      }),
    );
    assistantText = "Sorry, I could not process that right now.";
    yield { type: "delta", text: assistantText };
  }

  if (!assistantText.trim()) {
    assistantText = "Sorry, I could not process that right now.";
  }

  const turnAt = new Date().toISOString();
  const updatedTurns: VoiceCallSessionTurn[] = [
    ...session.turns,
    { role: "user", content: input.userMessage.trim(), at: turnAt },
    { role: "assistant", content: assistantText, at: turnAt },
  ];

  await getVoiceRepository().updateSessionTurns({
    sessionId: session.id,
    turns: updatedTurns,
    turnCount: session.turn_count + 1,
  });

  scheduleVoiceStreamOrchestration({
    businessId: input.businessId,
    callSid: input.callSid,
    callerPhone: callLog?.phone_number,
    clientMessage: input.userMessage,
    conversationHistory: updatedTurns,
  });

  yield {
    type: "done",
    text: assistantText,
    endCall: session.turn_count + 1 >= MAX_STREAM_TURNS,
  };
}

export async function appendVoiceStreamSessionTurn(input: {
  businessId: string;
  callSid: string;
  direction: "inbound" | "outbound";
  role: "user" | "assistant";
  content: string;
}): Promise<void> {
  if (!hasSupabaseEnv()) {
    return;
  }

  const session = await getOrCreateStreamSession({
    businessId: input.businessId,
    callSid: input.callSid,
    direction: input.direction,
  });

  if (!session) {
    return;
  }

  const now = new Date().toISOString();
  const turns: VoiceCallSessionTurn[] = [
    ...session.turns,
    { role: input.role, content: input.content.trim(), at: now },
  ];

  await getVoiceRepository().updateSessionTurns({
    sessionId: session.id,
    turns,
    turnCount: Math.max(session.turn_count, Math.ceil(turns.length / 2)),
  });

  if (input.role === "user") {
    scheduleVoiceStreamOrchestration({
      businessId: input.businessId,
      callSid: input.callSid,
      clientMessage: input.content,
      conversationHistory: turns,
    });
  }
}

export async function handleVoiceStreamLifecycle(input: {
  businessId: string;
  callSid: string;
  callLogId?: string | null;
  direction: "inbound" | "outbound";
  event: "start" | "stop";
  triggerReason?: string | null;
}): Promise<void> {
  if (!hasSupabaseEnv() || !input.callSid.trim()) {
    return;
  }

  // Internet Phone uses synthetic call keys and its own call table — never
  // create Twilio voice_call_logs rows for those sessions.
  if (input.callSid.trim().startsWith("inetphone:")) {
    return;
  }

  const repo = getVoiceRepository();
  const existing = await repo.findCallLogByExternalCallId(input.callSid);

  if (input.event === "start") {
    if (existing) {
      await repo.updateCallLog(existing.id, {
        status: "active",
        callMode: "ai",
        aiHandled: true,
      });
      return;
    }

    const callLogId = input.callLogId?.trim();
    if (callLogId) {
      const callLog = await repo.findCallLogById(input.businessId, callLogId);

      if (callLog) {
        if (
          callLog.external_call_id?.trim() &&
          callLog.external_call_id.trim() !== input.callSid
        ) {
          console.warn(
            "[voice-stream] ignored stream CallSid bind for already-bound call log",
            JSON.stringify({
              businessId: input.businessId,
              callLogId,
              existingCallSid: callLog.external_call_id,
              receivedCallSid: input.callSid,
            }),
          );
        } else {
          await repo.updateCallLog(callLog.id, {
            externalCallId: input.callSid,
            status: "active",
            callMode: "ai",
            aiHandled: true,
            triggerReason: input.triggerReason ?? undefined,
          });
          return;
        }
      }
    }

    await repo.insertCallLog({
      businessId: input.businessId,
      direction: input.direction,
      phoneNumber: "unknown",
      status: "active",
      provider: "twilio",
      externalCallId: input.callSid,
      triggerReason: input.triggerReason ?? "ai_stream",
      callMode: "ai",
      aiHandled: true,
    });
    return;
  }

  if (input.direction === "inbound" && existing?.call_mode === "human") {
    await markInboundCallAiFallback(input.businessId, input.callSid);
  }

  await markVoiceCallCompleted({
    callSid: input.callSid,
    aiHandled: true,
  });
}
