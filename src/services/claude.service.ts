import "server-only";

import { estimateTokensFromText } from "@/lib/ai/cost";
import type { AiProvider } from "@/lib/ai/constants";
import { ORCHESTRATOR_PLAN_TOOL_NAME } from "@/lib/ai/tools/orchestrator-gemini";
import {
  ORCHESTRATOR_CLAUDE_TOOL_CHOICE,
  ORCHESTRATOR_CLAUDE_TOOLS,
} from "@/lib/ai/tools/orchestrator-json-schema";
import { buildAssistantSystemInstruction } from "@/lib/gemini/prompts";
import type {
  GeminiServiceResult,
  GenerateAssistantReplyInput,
  GenerateTextInput,
} from "@/types/gemini.types";

function getClaudeApiKey(): string | null {
  return process.env.ANTHROPIC_API_KEY?.trim() || null;
}

export function hasClaudeEnv(): boolean {
  return Boolean(getClaudeApiKey());
}

function missingConfigError(): GeminiServiceResult {
  return {
    success: false,
    error: {
      code: "MISSING_CONFIG",
      message:
        "Anthropic API is not configured. Add ANTHROPIC_API_KEY to your environment.",
    },
  };
}

type ClaudeUsage = {
  inputTokens: number;
  outputTokens: number;
};

async function callClaudeMessages(input: {
  model: string;
  systemInstruction?: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  apiKey?: string;
  maxTokens?: number;
}): Promise<
  | { success: true; text: string; model: string; usage: ClaudeUsage }
  | { success: false; message: string }
> {
  const apiKey = input.apiKey?.trim() || getClaudeApiKey();

  if (!apiKey) {
    return { success: false, message: "Anthropic API key missing." };
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      max_tokens: input.maxTokens ?? 1024,
      system: input.systemInstruction,
      messages: input.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    return {
      success: false,
      message:
        body.slice(0, 300) || `Anthropic request failed (${response.status}).`,
    };
  }

  const payload = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
    model?: string;
  };

  const text = payload.content
    ?.map((block) => block.text ?? "")
    .join("")
    .trim();

  if (!text) {
    return { success: false, message: "Claude returned an empty response." };
  }

  const promptText = input.messages.map((message) => message.content).join("\n");

  return {
    success: true,
    text,
    model: payload.model ?? input.model,
    usage: {
      inputTokens: payload.usage?.input_tokens ?? estimateTokensFromText(promptText),
      outputTokens:
        payload.usage?.output_tokens ?? estimateTokensFromText(text),
    },
  };
}

type ProviderInput<T> = T & { apiKey?: string };

export async function generateClaudeText(
  input: ProviderInput<GenerateTextInput>,
): Promise<GeminiServiceResult & { usage?: ClaudeUsage; provider?: AiProvider }> {
  if (!hasClaudeEnv() && !input.apiKey) {
    return missingConfigError();
  }

  const model = input.model ?? "claude-3-5-haiku-latest";
  const result = await callClaudeMessages({
    model,
    systemInstruction: input.systemInstruction,
    messages: [{ role: "user", content: input.prompt }],
    apiKey: input.apiKey,
  });

  if (!result.success) {
    return {
      success: false,
      error: { code: "GENERATION_FAILED", message: result.message },
    };
  }

  return {
    success: true,
    data: { text: result.text, model: result.model },
    usage: result.usage,
    provider: "claude",
  };
}

export type ClaudeOrchestratorToolResult =
  | { success: true; data: { args: unknown; model: string }; usage?: ClaudeUsage }
  | {
      success: false;
      error: { code: "MISSING_CONFIG" | "GENERATION_FAILED"; message: string };
    };

export async function generateClaudeOrchestratorToolPlan(input: {
  model?: string;
  apiKey?: string;
  systemInstruction: string;
  prompt: string;
}): Promise<ClaudeOrchestratorToolResult> {
  if (!hasClaudeEnv() && !input.apiKey) {
    return {
      success: false,
      error: { code: "MISSING_CONFIG", message: "Anthropic API key missing." },
    };
  }

  const apiKey = input.apiKey?.trim() || getClaudeApiKey();

  if (!apiKey) {
    return {
      success: false,
      error: { code: "MISSING_CONFIG", message: "Anthropic API key missing." },
    };
  }

  const model = input.model ?? "claude-3-5-haiku-latest";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      temperature: 0.2,
      system: input.systemInstruction,
      messages: [{ role: "user", content: input.prompt }],
      tools: ORCHESTRATOR_CLAUDE_TOOLS,
      tool_choice: ORCHESTRATOR_CLAUDE_TOOL_CHOICE,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    return {
      success: false,
      error: {
        code: "GENERATION_FAILED",
        message:
          body.slice(0, 300) || `Anthropic request failed (${response.status}).`,
      },
    };
  }

  const payload = (await response.json()) as {
    content?: Array<{
      type?: string;
      name?: string;
      input?: unknown;
    }>;
    usage?: { input_tokens?: number; output_tokens?: number };
    model?: string;
  };

  const toolBlock = payload.content?.find(
    (block) =>
      block.type === "tool_use" && block.name === ORCHESTRATOR_PLAN_TOOL_NAME,
  );

  if (!toolBlock?.input) {
    return {
      success: false,
      error: {
        code: "GENERATION_FAILED",
        message: "Claude returned no plan_orchestration tool_use block.",
      },
    };
  }

  const promptText = `${input.systemInstruction}\n${input.prompt}`;

  return {
    success: true,
    data: {
      args: toolBlock.input,
      model: payload.model ?? model,
    },
    usage: {
      inputTokens:
        payload.usage?.input_tokens ?? estimateTokensFromText(promptText),
      outputTokens:
        payload.usage?.output_tokens ??
        estimateTokensFromText(JSON.stringify(toolBlock.input)),
    },
  };
}

export async function generateClaudeAssistantReply(
  input: ProviderInput<GenerateAssistantReplyInput>,
): Promise<GeminiServiceResult & { usage?: ClaudeUsage; provider?: AiProvider }> {
  if (!hasClaudeEnv() && !input.apiKey) {
    return missingConfigError();
  }

  const model = input.model ?? "claude-3-5-haiku-latest";
  const systemInstruction = buildAssistantSystemInstruction({
    systemPrompt: input.systemPrompt,
    language: input.language,
    knowledgeContext: input.knowledgeContext,
  });

  const history =
    input.conversationHistory?.map((message) => ({
      role: message.role,
      content: message.content,
    })) ?? [];

  const messages = [...history, { role: "user" as const, content: input.userMessage }];
  const result = await callClaudeMessages({
    model,
    systemInstruction,
    messages,
    apiKey: input.apiKey,
  });

  if (!result.success) {
    return {
      success: false,
      error: { code: "GENERATION_FAILED", message: result.message },
    };
  }

  return {
    success: true,
    data: { text: result.text, model: result.model },
    usage: result.usage,
    provider: "claude",
  };
}

const WEBSITE_KNOWLEDGE_CLAUDE_MODEL = "claude-3-5-sonnet-latest";

export async function generateClaudeKnowledgeJson(input: {
  systemInstruction?: string;
  prompt: string;
  maxTokens?: number;
  model?: string;
}): Promise<
  | { success: true; text: string }
  | { success: false; message: string }
> {
  if (!hasClaudeEnv()) {
    return { success: false, message: "Anthropic API key missing." };
  }

  const result = await callClaudeMessages({
    model: input.model ?? WEBSITE_KNOWLEDGE_CLAUDE_MODEL,
    systemInstruction: input.systemInstruction,
    messages: [{ role: "user", content: input.prompt }],
    maxTokens: input.maxTokens ?? 4096,
  });

  if (!result.success) {
    return { success: false, message: result.message };
  }

  return { success: true, text: result.text };
}
