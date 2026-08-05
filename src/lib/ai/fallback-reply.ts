import { getPlatformPromptContent } from "@/services/platform-prompts.service";
import { parseGuardFallbackPrompt } from "@orzu/platform-ai";

import { isLikelyBookingOrOrderMessage } from "@/lib/ai/booking-message-context";

export { isLikelyBookingOrOrderMessage };

function getFallbackByLanguage(): Record<string, string> {
  return parseGuardFallbackPrompt(getPlatformPromptContent("guard_fallback"));
}

function resolveActionFallbackReplyMessage(input: {
  language: string;
  clientMessage?: string | null;
}): string | null {
  if (!isLikelyBookingOrOrderMessage(input.clientMessage ?? "")) {
    return null;
  }

  const language = input.language.trim().toLowerCase();

  if (language.includes("russian") || language === "ru") {
    return "Могу оформить бронь прямо здесь. Напишите точную дату и время — сразу подтвержу.";
  }

  if (language.includes("uzbek") || language === "uz") {
    return "Bronni shu yerda rasmiylashtira olaman. Aniq sana va vaqtni yozing — darhol tasdiqlayman.";
  }

  return "I can book this for you right here. Share the exact date and time, and I will confirm it.";
}

function isGenericWaitingFallback(message: string): boolean {
  return [
    /help you right here in (this )?chat/i,
    /i('?ll| will) help you (right )?(now|here)/i,
    /checking this and will help/i,
    /checking the details now/i,
    /biroz kuting/i,
    /помогу[\s\S]{0,80}(здесь|чате|чат|сейчас)/i,
    /прямо сейчас[\s\S]{0,40}(здесь|помогу)/i,
    /проверяю[\s\S]{0,80}помогу/i,
    /shu yerda yordam beraman/i,
    /hozir[\s\S]{0,40}yordam/i,
  ].some((pattern) => pattern.test(message));
}

export function resolveAssistantFallbackReplyMessage(input: {
  language: string;
  clientMessage?: string | null;
  customMessage?: string | null;
}): string {
  const actionFallback = resolveActionFallbackReplyMessage({
    language: input.language,
    clientMessage: input.clientMessage,
  });

  if (actionFallback) {
    return actionFallback;
  }

  const custom = input.customMessage?.trim();

  if (custom && !isGenericWaitingFallback(custom)) {
    return custom;
  }

  const language = input.language.trim();
  const FALLBACK_BY_LANGUAGE = getFallbackByLanguage();

  return (
    FALLBACK_BY_LANGUAGE[language] ??
    FALLBACK_BY_LANGUAGE.English ??
    "I can help with that right here. What exact detail should I handle next?"
  );
}
