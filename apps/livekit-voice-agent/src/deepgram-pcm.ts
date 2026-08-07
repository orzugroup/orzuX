import WebSocket from "ws";

export type DeepgramPcmSession = {
  sendPcm: (pcm: Int16Array) => void;
  close: () => void;
};

function resolveDeepgramListenLanguage(language: string): string {
  const normalized = language.trim().toLowerCase();

  if (normalized.startsWith("uk") || normalized.includes("ukrain")) return "uk";
  if (normalized.startsWith("ru") || normalized.includes("russ")) return "ru";
  if (normalized.startsWith("de") || normalized.includes("german")) return "de";
  if (normalized.startsWith("es") || normalized.includes("spanish")) return "es";
  if (
    normalized.startsWith("en") ||
    normalized === "english" ||
    normalized === "multi" ||
    !normalized
  ) {
    return "multi";
  }

  return "multi";
}

function buildDeepgramListenUrl(language: string): string {
  const url = new URL("wss://api.deepgram.com/v1/listen");
  url.searchParams.set("model", "nova-3");
  url.searchParams.set("language", resolveDeepgramListenLanguage(language));
  url.searchParams.set("encoding", "linear16");
  url.searchParams.set("sample_rate", "16000");
  url.searchParams.set("channels", "1");
  url.searchParams.set("interim_results", "true");
  url.searchParams.set("endpointing", "600");
  url.searchParams.set("utterance_end_ms", "1500");
  url.searchParams.set("smart_format", "true");
  url.searchParams.set("vad_events", "true");
  return url.toString();
}

type DeepgramTranscriptMessage = {
  type?: string;
  is_final?: boolean;
  speech_final?: boolean;
  channel?: {
    alternatives?: Array<{ transcript?: string }>;
  };
};

export function startDeepgramPcmLive(input: {
  apiKey: string;
  language: string;
  onFinalTranscript: (text: string) => void;
  onSpeechStarted?: () => void;
  onError?: (message: string) => void;
}): DeepgramPcmSession {
  const socket = new WebSocket(buildDeepgramListenUrl(input.language), {
    headers: { Authorization: `Token ${input.apiKey.trim()}` },
  });

  let closed = false;
  const pending: Buffer[] = [];

  const flushPending = () => {
    if (socket.readyState !== WebSocket.OPEN) return;
    while (pending.length > 0) {
      socket.send(pending.shift()!);
    }
  };

  socket.on("open", () => {
    flushPending();
  });

  socket.on("message", (raw) => {
    try {
      const message = JSON.parse(String(raw)) as DeepgramTranscriptMessage;
      if (message.type === "SpeechStarted") {
        input.onSpeechStarted?.();
        return;
      }

      const transcript =
        message.channel?.alternatives?.[0]?.transcript?.trim() ?? "";
      if (!transcript) return;

      if (message.is_final || message.speech_final) {
        input.onFinalTranscript(transcript);
      }
    } catch {
      // ignore non-JSON keepalive frames
    }
  });

  socket.on("error", (error) => {
    input.onError?.(error.message);
  });

  return {
    sendPcm(pcm) {
      if (closed) return;
      const bytes = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(bytes);
      } else {
        pending.push(bytes);
        if (pending.length > 200) pending.shift();
      }
    },
    close() {
      if (closed) return;
      closed = true;
      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "CloseStream" }));
        }
      } catch {
        // ignore
      }
      socket.close();
    },
  };
}
