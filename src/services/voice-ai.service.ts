import "server-only";

import { buildVoiceSystemPrompt } from "@/lib/voice/prompts";
import {
  buildCrmReplyContext,
  type CrmReplyContactSnapshot,
} from "@/lib/ai/crm-reply-context";
import {
  ensurePlatformPromptsLoaded,
  getPlatformPromptContent,
} from "@/services/platform-prompts.service";
import { getVoicePhonePrompts } from "@/lib/voice/language";
import {
  buildGatherActionUrl,
  buildGoodbyeTwiml,
  buildPlayAndGatherTwiml,
  buildPlayTwiml,
  buildSayAndGatherTwiml,
  buildStaticSayTwiml,
  mapVoiceLanguageToTwilioLocale,
  sanitizeForSpeech,
} from "@/lib/voice/twiml";
import { isVoiceStreamEnabledAsync, getVoiceStreamConnectWsUrl } from "@/lib/voice/stream-config";
import { buildMediaStreamConnectTwiml } from "@/lib/voice/stream-twiml";
import { hasSupabaseEnv } from "@/lib/env";
import { getVoiceAiBusinessContext } from "@/repositories/business-context.repository";
import { getConversationRepository } from "@/repositories/conversation.repository";
import {
  getVoiceRepository,
  type VoiceCallSessionTurn,
} from "@/repositories/voice.repository";
import { buildEffectiveAgentPrompt } from "@/features/ai-assistant/communication-styles";
import { resolveVoiceStreamLlm } from "@/lib/ai/voice-stream-model";
import { resolveOpenAiApiKeyForVoice } from "@/lib/ai/platform-api-keys";
import { resolvePlatformAiForUseCase } from "@/services/platform-ai-config.service";
import {
  getDefaultModelForProvider,
  isLlmProvider,
  type LlmAiProvider,
} from "@orzu/platform-ai";
import { generateTextWithFallback } from "@/services/llm.service";
import { loadConversationMemory } from "@/services/conversation-memory.service";
import { listKnowledgeEntriesForBusiness } from "@/services/messaging.service";
import { fetchBusinessProfileAiContext } from "@/services/business-profile-context.service";
import { scheduleVoiceTurnOrchestration } from "@/services/voice-orchestrator.service";
import { markVoiceCallCompleted } from "@/services/voice-inbox.service";
import {
  resolveTwilioWebhookValidationContext,
} from "@/services/twilio-integration.service";
import {
  applyCallRecordingToTwiml,
  resolveRecordingCallbackUrl,
} from "@/services/voice-recording.service";
import {
  buildHandoffAgentTwiml,
  markVoiceCallHandoffByCallSid,
} from "@/services/voice-handoff.service";
import {
  customerConfirmedHumanHandoff,
  customerExplicitlyRequestedHuman,
} from "@/utils/human-handoff-policy";
import { getVoiceAgentSettings } from "@/services/voice-config.service";
import {
  loadPhoneVoiceSettings,
  synthesizePhoneSpeechAudio,
} from "@/services/voice-phone-tts.service";
import {
  hasOpenAiEnv,
  streamOpenAiText,
} from "@/services/openai.service";
import type { Database } from "@/types/database.types";
import type { VoiceAgentSettings } from "@/types/voice-agent.types";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Hard cap on AI voice turns per call session (gather + stream). */
const MAX_VOICE_TURNS = 8;
/** Prompt history uses the same 8-turn window as the call turn cap. */
const MAX_VOICE_HISTORY_TURNS = MAX_VOICE_TURNS;
const MAX_VOICE_PROMPT_CHARS = 3500;
const MAX_KNOWLEDGE_ENTRIES = 12;
const MAX_KNOWLEDGE_CONTENT_CHARS = 400;
const MAX_STREAM_KNOWLEDGE_ENTRIES = 3;
const MAX_STREAM_KNOWLEDGE_CONTENT_CHARS = 180;

type VoiceSessionState = {
  id: string;
  business_id: string;
  call_sid: string;
  direction: string;
  turns: VoiceCallSessionTurn[];
  turn_count: number;
};

async function loadBusinessContext(
  businessId: string,
  options?: { streamMode?: boolean },
) {
  const admin = getVoiceRepository().client;
  const streamMode = options?.streamMode ?? false;
  const knowledgeLimit = streamMode
    ? MAX_STREAM_KNOWLEDGE_ENTRIES
    : MAX_KNOWLEDGE_ENTRIES;
  const knowledgeChars = streamMode
    ? MAX_STREAM_KNOWLEDGE_CONTENT_CHARS
    : MAX_KNOWLEDGE_CONTENT_CHARS;

  const [context, knowledgeEntries, profileResult] = await Promise.all([
    getVoiceAiBusinessContext(businessId),
    listKnowledgeEntriesForBusiness(admin, businessId),
    admin
      .from("ai_assistant_profile")
      .select("system_prompt, language, communication_style, name")
      .eq("business_id", businessId)
      .maybeSingle(),
  ]);

  const profile = profileResult.data;
  const baseSystemPrompt = profile?.system_prompt?.trim() || context.systemPrompt;

  let knowledgeContext = knowledgeEntries.slice(0, knowledgeLimit).map((entry) => ({
    id: entry.id,
    citation: entry.citation,
    category: entry.category?.trim() || "General",
    title: entry.title,
    content: entry.content.slice(0, knowledgeChars),
  }));

  if (knowledgeContext.length === 0) {
    const profileFallback = await fetchBusinessProfileAiContext(businessId, admin);
    if (profileFallback) {
      knowledgeContext = [
        {
          id: "business-profile",
          citation: "BP-1",
          category: "Profile",
          title: "Business profile",
          content: profileFallback.slice(0, knowledgeChars),
        },
      ];
    }
  }

  return {
    businessName: context.businessName,
    agentName: profile?.name?.trim() || null,
    provider: context.provider,
    model: context.model,
    language: profile?.language?.trim() || context.language,
    systemPrompt: buildEffectiveAgentPrompt({
      systemPrompt: baseSystemPrompt,
      communicationStyle: profile?.communication_style,
    }),
    knowledgeContext,
  };
}

function buildVoiceConversationPrompt(input: {
  userMessage: string;
  conversationHistory: VoiceCallSessionTurn[];
}): string {
  const recentHistory = input.conversationHistory.slice(
    -MAX_VOICE_HISTORY_TURNS * 2,
  );
  const historyLines = recentHistory.map((turn) =>
    turn.role === "user"
      ? `Customer: ${turn.content}`
      : `Assistant: ${turn.content}`,
  );
  historyLines.push(`Customer: ${input.userMessage}`);
  historyLines.push("Assistant:");

  const prompt = historyLines.join("\n");
  if (prompt.length <= MAX_VOICE_PROMPT_CHARS) {
    return prompt;
  }

  return prompt.slice(-MAX_VOICE_PROMPT_CHARS);
}

async function resolveStreamVoiceLlm(
  preferredProvider: string,
  configuredModel?: string | null,
): Promise<{
  provider: LlmAiProvider;
  model: string;
  apiKey: string | null;
}> {
  const platform = await resolvePlatformAiForUseCase("ai_phone_call");

  if (platform && isLlmProvider(platform.provider)) {
    return {
      provider: platform.provider,
      model:
        platform.model ??
        configuredModel?.trim() ??
        getDefaultModelForProvider(platform.provider),
      apiKey: platform.apiKey,
    };
  }

  const legacy = resolveVoiceStreamLlm(preferredProvider, configuredModel);
  return { ...legacy, apiKey: null };
}

async function fetchCrmReplySnapshot(
  admin: SupabaseClient<Database>,
  businessId: string,
  contactId: string,
): Promise<CrmReplyContactSnapshot | null> {
  const [{ data: contact }, { count: openTaskCount }, { data: openDeals }] =
    await Promise.all([
      admin
        .from("contacts")
        .select(
          "name, pipeline_stage, deal_value, lead_score, ai_summary, expected_close_date",
        )
        .eq("id", contactId)
        .eq("business_id", businessId)
        .maybeSingle(),
      admin
        .from("crm_tasks")
        .select("id", { count: "exact", head: true })
        .eq("contact_id", contactId)
        .eq("business_id", businessId)
        .eq("status", "open"),
      admin
        .from("crm_deals")
        .select("id, title, value, stage")
        .eq("contact_id", contactId)
        .eq("business_id", businessId)
        .not("status", "eq", "lost")
        .not("status", "eq", "won")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  if (!contact) {
    return null;
  }

  return {
    name: contact.name,
    pipelineStage: contact.pipeline_stage,
    dealValue: contact.deal_value,
    leadScore: contact.lead_score,
    expectedCloseDate: contact.expected_close_date,
    aiSummary: contact.ai_summary,
    openTaskCount: openTaskCount ?? 0,
    openDeals: (openDeals ?? []).map((deal) => ({
      id: String(deal.id),
      title: String(deal.title ?? ""),
      value: typeof deal.value === "number" ? deal.value : null,
      stage: deal.stage ? String(deal.stage) : null,
    })),
  };
}

async function loadVoiceCallerMemoryContext(input: {
  businessId: string;
  callerPhone: string;
}): Promise<{
  conversationSummary: string | null;
  crmContext: string | null;
}> {
  const admin = getVoiceRepository().client;
  const conversationRepo = getConversationRepository(admin);
  const contactId = await conversationRepo.findContactIdByPhone(
    input.businessId,
    input.callerPhone,
  );

  if (!contactId) {
    return { conversationSummary: null, crmContext: null };
  }

  const [{ data: latestConversation }, crmSnapshot] = await Promise.all([
    admin
      .from("conversations")
      .select("id")
      .eq("business_id", input.businessId)
      .eq("contact_id", contactId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    fetchCrmReplySnapshot(admin, input.businessId, contactId),
  ]);

  let conversationSummary: string | null = null;

  if (latestConversation?.id) {
    const memory = await loadConversationMemory(
      admin,
      latestConversation.id,
      input.businessId,
    );
    conversationSummary = memory?.aiSummary ?? null;
  }

  const crmContext = buildCrmReplyContext(crmSnapshot);

  return {
    conversationSummary,
    crmContext: crmContext || null,
  };
}

async function prepareVoiceAiReply(input: {
  businessId: string;
  userMessage: string;
  conversationHistory: VoiceCallSessionTurn[];
  direction: "inbound" | "outbound";
  triggerReason?: string | null;
  settings: VoiceAgentSettings;
  callObjective?: string | null;
  streamMode?: boolean;
  callerPhone?: string | null;
}) {
  await ensurePlatformPromptsLoaded();

  const context = await loadBusinessContext(input.businessId, {
    streamMode: input.streamMode,
  });
  const phoneVoice = await loadPhoneVoiceSettings(input.businessId);
  const language =
    phoneVoice.language || input.settings.voiceLanguage || context.language;
  const { provider, model, apiKey } = input.streamMode
    ? await resolveStreamVoiceLlm(context.provider, context.model)
    : {
        provider: context.provider as LlmAiProvider,
        model: context.model,
        apiKey: null as string | null,
      };

  const callerPhone = input.callerPhone?.trim() || null;
  const memoryContext = callerPhone
    ? await loadVoiceCallerMemoryContext({
        businessId: input.businessId,
        callerPhone,
      })
    : { conversationSummary: null, crmContext: null };

  const systemPrompt = buildVoiceSystemPrompt({
    businessName: context.businessName,
    systemPrompt: context.systemPrompt,
    language,
    knowledgeContext: context.knowledgeContext,
    customVoicePrompt: input.settings.voiceSystemPrompt,
    voiceRules: getPlatformPromptContent("voice"),
    callObjective: input.callObjective,
    direction: input.direction,
    triggerReason: input.triggerReason,
    realtime: input.streamMode,
    conversationSummary: memoryContext.conversationSummary,
    crmContext: memoryContext.crmContext,
  });

  const conversationPrompt = buildVoiceConversationPrompt({
    userMessage: input.userMessage,
    conversationHistory: input.conversationHistory,
  });

  return {
    context,
    provider,
    model,
    apiKey,
    systemPrompt,
    conversationPrompt,
  };
}

export type VoiceAiStreamChunk =
  | { type: "delta"; text: string }
  | { type: "done"; text: string };

export type VoiceStreamLlmConfig = {
  systemPrompt: string;
  llmModel: string;
  llmProvider: LlmAiProvider;
  openaiApiKey: string | null;
};

export async function buildVoiceStreamLlmConfig(input: {
  businessId: string;
  direction: "inbound" | "outbound";
  triggerReason?: string | null;
  settings: VoiceAgentSettings;
  callObjective?: string | null;
  callerPhone?: string | null;
}): Promise<VoiceStreamLlmConfig> {
  const prepared = await prepareVoiceAiReply({
    businessId: input.businessId,
    userMessage: "",
    conversationHistory: [],
    direction: input.direction,
    triggerReason: input.triggerReason,
    settings: input.settings,
    callObjective: input.callObjective,
    streamMode: true,
    callerPhone: input.callerPhone,
  });

  const openaiApiKey =
    prepared.provider === "openai"
      ? prepared.apiKey?.trim() || (await resolveOpenAiApiKeyForVoice())
      : null;

  return {
    systemPrompt: prepared.systemPrompt,
    llmModel: prepared.model,
    llmProvider: prepared.provider,
    openaiApiKey,
  };
}

export async function* generateVoiceAiReplyStream(input: {
  businessId: string;
  userMessage: string;
  conversationHistory: VoiceCallSessionTurn[];
  direction: "inbound" | "outbound";
  triggerReason?: string | null;
  settings: VoiceAgentSettings;
  callObjective?: string | null;
  callerPhone?: string | null;
}): AsyncGenerator<VoiceAiStreamChunk, void, void> {
  const prepared = await prepareVoiceAiReply({
    ...input,
    streamMode: true,
  });

  if (prepared.provider === "openai" && (hasOpenAiEnv() || prepared.apiKey)) {
    let fullText = "";

    try {
      for await (const delta of streamOpenAiText({
        model: prepared.model,
        systemInstruction: prepared.systemPrompt,
        prompt: prepared.conversationPrompt,
        maxTokens: 180,
        temperature: 0.6,
        apiKey: prepared.apiKey ?? undefined,
      })) {
        fullText += delta;
        yield { type: "delta", text: delta };
      }

      yield { type: "done", text: sanitizeForSpeech(fullText) };
      return;
    } catch (error) {
      console.warn(
        "[voice-ai] OpenAI stream failed, falling back",
        error instanceof Error ? error.message : "unknown",
      );
    }
  }

  const result = await generateTextWithFallback({
    businessId: input.businessId,
    preferredProvider: prepared.provider,
    model: prepared.model,
    systemInstruction: prepared.systemPrompt,
    prompt: prepared.conversationPrompt,
    callType: "voice",
    apiKey: prepared.apiKey ?? undefined,
  });

  if (!result.success) {
    throw new Error(result.error.message);
  }

  const text = sanitizeForSpeech(result.data.text);
  yield { type: "delta", text };
  yield { type: "done", text };
}

async function getOrCreateSession(input: {
  businessId: string;
  callSid: string;
  direction: "inbound" | "outbound";
}): Promise<VoiceSessionState | null> {
  if (!hasSupabaseEnv()) {
    return null;
  }

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
    turns: [],
  };
}

async function appendSessionTurn(input: {
  sessionId: string;
  turns: VoiceCallSessionTurn[];
  turnCount: number;
}) {
  await getVoiceRepository().updateSessionTurns({
    sessionId: input.sessionId,
    turns: input.turns,
    turnCount: input.turnCount,
  });
}

export async function generateVoiceAiReply(input: {
  businessId: string;
  userMessage: string;
  conversationHistory: VoiceCallSessionTurn[];
  direction: "inbound" | "outbound";
  triggerReason?: string | null;
  settings: VoiceAgentSettings;
  callObjective?: string | null;
  callerPhone?: string | null;
}): Promise<{ success: true; text: string } | { success: false; message: string }> {
  const prepared = await prepareVoiceAiReply(input);

  const result = await generateTextWithFallback({
    businessId: input.businessId,
    preferredProvider: prepared.provider,
    model: prepared.model,
    systemInstruction: prepared.systemPrompt,
    prompt: prepared.conversationPrompt,
    callType: "voice",
  });

  if (!result.success) {
    console.error(
      "[voice-ai] reply generation failed",
      JSON.stringify({
        businessId: input.businessId,
        error: result.error.message,
        attemptedProviders: "attemptedProviders" in result ? result.attemptedProviders : [],
      }),
    );

    return {
      success: false,
      message: result.error.message,
    };
  }

  return {
    success: true,
    text: sanitizeForSpeech(result.data.text),
  };
}

export async function generateVoiceOpeningLine(input: {
  businessId: string;
  direction: "inbound" | "outbound";
  callObjective: string;
  settings: VoiceAgentSettings;
  triggerReason?: string | null;
}): Promise<string | null> {
  const objective = input.callObjective.trim();
  if (!objective) {
    return null;
  }

  const context = await loadBusinessContext(input.businessId);
  await ensurePlatformPromptsLoaded();
  const phoneVoice = await loadPhoneVoiceSettings(input.businessId);
  const language =
    phoneVoice.language || input.settings.voiceLanguage || context.language;

  const systemPrompt = buildVoiceSystemPrompt({
    businessName: context.businessName,
    systemPrompt: context.systemPrompt,
    language,
    knowledgeContext: context.knowledgeContext,
    customVoicePrompt: input.settings.voiceSystemPrompt,
    voiceRules: getPlatformPromptContent("voice"),
    callObjective: objective,
    direction: input.direction,
    triggerReason: input.triggerReason,
  });

  const result = await generateTextWithFallback({
    businessId: input.businessId,
    preferredProvider: context.provider as "gemini" | "openai" | "claude",
    model: context.model,
    systemInstruction: systemPrompt,
    prompt:
      "Write only one short opening sentence for this phone call. No quotes, no markdown.",
    callType: "voice",
  });

  if (!result.success) {
    return null;
  }

  return sanitizeForSpeech(result.data.text);
}

function resolveOpeningLine(
  settings: VoiceAgentSettings,
  direction: "inbound" | "outbound",
) {
  return direction === "inbound"
    ? settings.inboundGreeting
    : settings.outboundScript;
}

async function buildSpokenConversationTwiml(input: {
  businessId: string;
  callSid: string;
  speech: string;
  gatherActionUrl: string;
  speechLocale: string;
  language: string;
  repromptSpeech: string;
  goodbyeSpeech: string;
  turnKey: string;
  includeGather?: boolean;
}): Promise<string> {
  const phoneVoice = await loadPhoneVoiceSettings(input.businessId);

  if (phoneVoice.useElevenLabs && input.callSid.trim()) {
    const audio = await synthesizePhoneSpeechAudio({
      businessId: input.businessId,
      callSid: input.callSid,
      text: input.speech,
      turnKey: input.turnKey,
    });

    if (audio.success) {
      if (input.includeGather === false) {
        return buildPlayTwiml({
          audioUrl: audio.audioUrl,
          speechLocale: input.speechLocale,
          goodbyeSpeech: input.goodbyeSpeech,
        });
      }

      return buildPlayAndGatherTwiml({
        audioUrl: audio.audioUrl,
        gatherActionUrl: input.gatherActionUrl,
        speechLocale: input.speechLocale,
        repromptSpeech: input.repromptSpeech,
        goodbyeSpeech: input.goodbyeSpeech,
      });
    }
  }

  if (input.includeGather === false) {
    return buildStaticSayTwiml({
      speech: `${input.speech} ${input.goodbyeSpeech}`,
      speechLocale: input.speechLocale,
    });
  }

  return buildSayAndGatherTwiml({
    speech: input.speech,
    gatherActionUrl: input.gatherActionUrl,
    speechLocale: input.speechLocale,
    reprompt: input.repromptSpeech,
  });
}

export async function buildVoiceConversationTwiml(input: {
  businessId: string;
  direction: "inbound" | "outbound";
  triggerReason?: string | null;
  forceAi?: boolean;
  callSid?: string | null;
  callLogId?: string | null;
}): Promise<string> {
  const settings = await getVoiceAgentSettings(input.businessId);
  const phoneVoice = await loadPhoneVoiceSettings(input.businessId);
  const speechLocale = mapVoiceLanguageToTwilioLocale(phoneVoice.language);
  const prompts = getVoicePhonePrompts(phoneVoice.language);
  const opening = resolveOpeningLine(settings, input.direction);
  const aiActive = input.forceAi || settings.aiEnabled;
  const realCallSid = input.callSid?.trim() || null;
  const turnCallSid = realCallSid ?? `opening-${Date.now()}`;

  if (!aiActive) {
    return applyCallRecordingToTwiml(
      input.businessId,
      buildStaticSayTwiml({ speech: opening, speechLocale }),
    );
  }

  const twilioValidation = await resolveTwilioWebhookValidationContext(
    input.businessId,
  );
  const mediaStreamAllowed = Boolean(twilioValidation?.authToken);

  if (
    mediaStreamAllowed &&
    (await isVoiceStreamEnabledAsync()) &&
    realCallSid &&
    phoneVoice.voiceId
  ) {
    const wsUrl = getVoiceStreamConnectWsUrl();
    if (wsUrl) {
      const recordingCallback = await resolveRecordingCallbackUrl(input.businessId);

      return applyCallRecordingToTwiml(
        input.businessId,
        buildMediaStreamConnectTwiml({
          businessId: input.businessId,
          wsUrl,
          callSid: realCallSid,
          direction: input.direction,
          triggerReason: input.triggerReason,
          callLogId: input.callLogId,
          recordingStatusCallback: recordingCallback,
        }),
      );
    }
  }

  const gatherUrl = buildGatherActionUrl({
    businessId: input.businessId,
    direction: input.direction,
    triggerReason: input.triggerReason,
  });

  const twiml = await buildSpokenConversationTwiml({
    businessId: input.businessId,
    callSid: turnCallSid,
    speech: opening,
    gatherActionUrl: gatherUrl,
    speechLocale,
    language: phoneVoice.language,
    repromptSpeech:
      input.direction === "outbound"
        ? prompts.outboundReprompt
        : prompts.inboundReprompt,
    goodbyeSpeech: prompts.goodbye,
    turnKey: "opening",
  });

  return applyCallRecordingToTwiml(input.businessId, twiml);
}

export async function handleVoiceGatherInput(input: {
  businessId: string;
  callSid: string;
  direction: "inbound" | "outbound";
  speechResult: string;
  triggerReason?: string | null;
  callerPhone?: string | null;
}): Promise<string> {
  const settings = await getVoiceAgentSettings(input.businessId);
  const phoneVoice = await loadPhoneVoiceSettings(input.businessId);
  const speechLocale = mapVoiceLanguageToTwilioLocale(phoneVoice.language);
  const prompts = getVoicePhonePrompts(phoneVoice.language);
  const repo = getVoiceRepository();
  const callLog = await repo.findCallLogByExternalCallId(input.callSid);
  const aiActive =
    settings.aiEnabled ||
    callLog?.call_mode === "ai" ||
    callLog?.call_mode === "handoff";

  if (!aiActive) {
    void markVoiceCallCompleted({ callSid: input.callSid, aiHandled: false });
    return buildGoodbyeTwiml(speechLocale);
  }

  const session = await getOrCreateSession({
    businessId: input.businessId,
    callSid: input.callSid,
    direction: input.direction,
  });

  if (!session) {
    return buildStaticSayTwiml({
      speech: prompts.error,
      speechLocale,
    });
  }

  const userSpeech = input.speechResult.trim();

  if (!userSpeech) {
    const gatherUrl = buildGatherActionUrl({
      businessId: input.businessId,
      direction: input.direction,
      triggerReason: input.triggerReason,
    });

    return await buildSpokenConversationTwiml({
      businessId: input.businessId,
      callSid: input.callSid,
      speech: prompts.repeat,
      gatherActionUrl: gatherUrl,
      speechLocale,
      language: phoneVoice.language,
      repromptSpeech: prompts.repeat,
      goodbyeSpeech: prompts.goodbye,
      turnKey: `repeat-${session.turn_count}`,
    });
  }

  if (session.turn_count >= MAX_VOICE_TURNS) {
    void markVoiceCallCompleted({ callSid: input.callSid, aiHandled: true });
    return applyCallRecordingToTwiml(
      input.businessId,
      buildGoodbyeTwiml(speechLocale),
    );
  }

  const orzuNumber = await import("@/services/orzu-voice-numbers.service").then(
    (module) => module.getActiveOrzuVoiceNumber(input.businessId),
  );
  const shouldHandoff =
    Boolean(orzuNumber?.forwardToE164?.trim()) &&
    (customerExplicitlyRequestedHuman(userSpeech) ||
      customerConfirmedHumanHandoff(userSpeech, session.turns));

  if (shouldHandoff) {
    void markVoiceCallHandoffByCallSid(input.callSid);
    const handoffTwiml = await buildHandoffAgentTwiml(input.businessId);
    return applyCallRecordingToTwiml(input.businessId, handoffTwiml);
  }

  const reply = await generateVoiceAiReply({
    businessId: input.businessId,
    userMessage: userSpeech,
    conversationHistory: session.turns,
    direction: input.direction,
    triggerReason: input.triggerReason,
    settings,
    callObjective: callLog?.custom_prompt,
    callerPhone: input.callerPhone,
  });

  const assistantText = reply.success
    ? reply.text
    : "Sorry, I could not process that right now. A team member will follow up with you soon.";

  const updatedTurns: VoiceCallSessionTurn[] = [
    ...session.turns,
    { role: "user", content: userSpeech },
    { role: "assistant", content: assistantText },
  ];

  await appendSessionTurn({
    sessionId: session.id,
    turns: updatedTurns,
    turnCount: session.turn_count + 1,
  });

  if (input.callerPhone?.trim()) {
    void scheduleVoiceTurnOrchestration({
      businessId: input.businessId,
      callerPhone: input.callerPhone.trim(),
      callSid: input.callSid,
      clientMessage: userSpeech,
      conversationHistory: updatedTurns,
    });
  }

  const nextTurnCount = session.turn_count + 1;

  if (nextTurnCount >= MAX_VOICE_TURNS) {
    void markVoiceCallCompleted({ callSid: input.callSid, aiHandled: true });

    return applyCallRecordingToTwiml(
      input.businessId,
      await buildSpokenConversationTwiml({
        businessId: input.businessId,
        callSid: input.callSid,
        speech: `${assistantText} ${prompts.goodbye}`,
        gatherActionUrl: "",
        speechLocale,
        language: phoneVoice.language,
        repromptSpeech: prompts.repeat,
        goodbyeSpeech: prompts.goodbye,
        turnKey: `final-${nextTurnCount}`,
        includeGather: false,
      }),
    );
  }

  const gatherUrl = buildGatherActionUrl({
    businessId: input.businessId,
    direction: input.direction,
    triggerReason: input.triggerReason,
  });

  return applyCallRecordingToTwiml(
    input.businessId,
    await buildSpokenConversationTwiml({
      businessId: input.businessId,
      callSid: input.callSid,
      speech: assistantText,
      gatherActionUrl: gatherUrl,
      speechLocale,
      language: phoneVoice.language,
      repromptSpeech: prompts.repeat,
      goodbyeSpeech: prompts.goodbye,
      turnKey: `turn-${nextTurnCount}`,
    }),
  );
}
