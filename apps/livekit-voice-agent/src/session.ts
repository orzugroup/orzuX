import {
  AudioFrame,
  AudioSource,
  AudioStream,
  LocalAudioTrack,
  Room,
  RoomEvent,
  TrackKind,
  TrackPublishOptions,
  TrackSource,
  type RemoteTrack,
} from "@livekit/rtc-node";

import {
  appendVoiceStreamTurn,
  fetchVoiceStreamContext,
  notifyInternetPhoneLifecycle,
  requestVoiceStreamReply,
  type VoiceStreamContext,
} from "./config.js";
import { startDeepgramPcmLive, type DeepgramPcmSession } from "./deepgram-pcm.js";
import { streamElevenLabsPcm } from "./elevenlabs-pcm.js";
import type { RuntimeAiKeyProvider } from "./runtime-keys.js";

const SAMPLE_RATE = 16_000;
const FRAME_SAMPLES = 320; // 20ms @ 16kHz
const HUMAN_REQUEST_RE =
  /\b(human|agent|manager|operator|person|сотрудник|менеджер|человек|оператор)\b/i;

export type JoinPayload = {
  callId: string;
  businessId: string;
  roomName: string;
  livekitUrl: string;
  token: string;
  aiIdentity: string;
  callKey: string;
};

export class LiveKitVoiceAgentSession {
  private room: Room | null = null;
  private audioSource: AudioSource | null = null;
  private localTrack: LocalAudioTrack | null = null;
  private deepgram: DeepgramPcmSession | null = null;
  private context: VoiceStreamContext | null = null;
  private muted = false;
  private closed = false;
  private speaking = false;
  private turnInFlight = false;
  private ttsAbort: AbortController | null = null;
  private pcmQueue: Int16Array[] = [];
  private pumpTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly payload: JoinPayload,
    private readonly appUrl: string,
    private readonly secret: string,
    private readonly keys: RuntimeAiKeyProvider,
    private readonly onClosed?: (callId: string) => void,
  ) {}

  async start(): Promise<void> {
    const room = new Room();
    this.room = room;

    room.on(RoomEvent.TrackSubscribed, (track) => {
      void this.handleTrackSubscribed(track);
    });

    room.on(RoomEvent.Disconnected, () => {
      void this.shutdown("disconnected");
    });

    room.on(RoomEvent.DataReceived, (payload, participant) => {
      try {
        const text = new TextDecoder().decode(payload);
        const message = JSON.parse(text) as { type?: string };
        if (message.type === "handoff") {
          void this.handoff();
        } else if (message.type === "end") {
          void this.shutdown("end");
        }
      } catch {
        console.warn(
          "[livekit-voice-agent] ignored data from",
          participant?.identity,
        );
      }
    });

    this.audioSource = new AudioSource(SAMPLE_RATE, 1);
    this.localTrack = LocalAudioTrack.createAudioTrack(
      "ai-voice",
      this.audioSource,
    );
    const options = new TrackPublishOptions();
    options.source = TrackSource.SOURCE_MICROPHONE;

    await room.connect(this.payload.livekitUrl, this.payload.token, {
      autoSubscribe: true,
      dynacast: true,
    });

    await room.localParticipant?.publishTrack(this.localTrack, options);
    this.startSilencePump();

    await notifyInternetPhoneLifecycle({
      appUrl: this.appUrl,
      secret: this.secret,
      callId: this.payload.callId,
      event: "ai_joined",
    });

    try {
      this.context = await fetchVoiceStreamContext({
        appUrl: this.appUrl,
        secret: this.secret,
        businessId: this.payload.businessId,
        callSid: this.payload.callKey,
      });
    } catch (error) {
      console.error(
        "[livekit-voice-agent] context failed",
        error instanceof Error ? error.message : error,
      );
      await notifyInternetPhoneLifecycle({
        appUrl: this.appUrl,
        secret: this.secret,
        callId: this.payload.callId,
        event: "ai_failed",
      });
      await this.shutdown("context_failed");
      return;
    }

    this.deepgram = startDeepgramPcmLive({
      apiKey: this.keys.deepgramApiKey,
      language: this.context.deepgramLanguage || this.context.language,
      onFinalTranscript: (text) => {
        void this.handleUserTranscript(text);
      },
      onSpeechStarted: () => {
        if (this.speaking) {
          this.interruptSpeech();
        }
      },
      onError: (message) => {
        console.warn("[livekit-voice-agent] deepgram error", message);
      },
    });

    await notifyInternetPhoneLifecycle({
      appUrl: this.appUrl,
      secret: this.secret,
      callId: this.payload.callId,
      event: "ai_active",
    });

    if (this.context.openingLine.trim()) {
      await this.speak(this.context.openingLine);
      await appendVoiceStreamTurn({
        appUrl: this.appUrl,
        secret: this.secret,
        businessId: this.payload.businessId,
        callSid: this.payload.callKey,
        role: "assistant",
        content: this.context.openingLine,
      });
    }
  }

  async handoff(): Promise<void> {
    if (this.muted || this.closed) return;
    this.muted = true;
    this.interruptSpeech();
    this.deepgram?.close();
    this.deepgram = null;

    await notifyInternetPhoneLifecycle({
      appUrl: this.appUrl,
      secret: this.secret,
      callId: this.payload.callId,
      event: "ai_muted",
    });

    console.info(
      "[livekit-voice-agent] handoff — AI muted",
      this.payload.callId,
    );
  }

  async shutdown(reason: string): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.interruptSpeech();
    this.deepgram?.close();
    this.deepgram = null;

    if (this.pumpTimer) {
      clearInterval(this.pumpTimer);
      this.pumpTimer = null;
    }

    try {
      await this.localTrack?.close();
    } catch {
      // ignore
    }

    try {
      await this.room?.disconnect();
    } catch {
      // ignore
    }

    this.room = null;
    this.localTrack = null;
    this.audioSource = null;

    await notifyInternetPhoneLifecycle({
      appUrl: this.appUrl,
      secret: this.secret,
      callId: this.payload.callId,
      event: "ai_left",
    });

    console.info("[livekit-voice-agent] session ended", {
      callId: this.payload.callId,
      reason,
    });

    this.onClosed?.(this.payload.callId);
  }

  private async handleTrackSubscribed(track: RemoteTrack): Promise<void> {
    if (this.closed || this.muted) return;
    if (track.kind !== TrackKind.KIND_AUDIO) return;

    const stream = new AudioStream(track, SAMPLE_RATE, 1);
    const reader = stream.getReader();

    try {
      while (!this.closed && !this.muted) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        if (this.speaking) continue;
        this.deepgram?.sendPcm(value.data);
      }
    } catch (error) {
      console.warn(
        "[livekit-voice-agent] audio stream ended",
        error instanceof Error ? error.message : "unknown",
      );
    } finally {
      reader.releaseLock();
    }
  }

  private async handleUserTranscript(text: string): Promise<void> {
    if (this.closed || this.muted || this.turnInFlight) return;
    const cleaned = text.trim();
    if (!cleaned) return;

    this.turnInFlight = true;
    try {
      if (HUMAN_REQUEST_RE.test(cleaned)) {
        await notifyInternetPhoneLifecycle({
          appUrl: this.appUrl,
          secret: this.secret,
          callId: this.payload.callId,
          event: "staff_requested",
        });
      }

      // Reply API persists user+assistant turns in voice_call_sessions.
      const reply = await requestVoiceStreamReply({
        appUrl: this.appUrl,
        secret: this.secret,
        businessId: this.payload.businessId,
        callSid: this.payload.callKey,
        userMessage: cleaned,
      });

      const answer = reply.text?.trim();
      if (!answer) return;

      await this.speak(answer);

      if (reply.endCall) {
        await this.shutdown("ai_end");
      }
    } catch (error) {
      console.error(
        "[livekit-voice-agent] turn failed",
        error instanceof Error ? error.message : error,
      );
      const fallback = this.context?.errorPrompt || "Sorry, please repeat that.";
      await this.speak(fallback);
    } finally {
      this.turnInFlight = false;
    }
  }

  private interruptSpeech(): void {
    this.ttsAbort?.abort();
    this.ttsAbort = null;
    this.speaking = false;
    this.pcmQueue = [];
  }

  private async speak(text: string): Promise<void> {
    if (this.closed || this.muted || !this.context || !this.audioSource) return;

    this.interruptSpeech();
    const abort = new AbortController();
    this.ttsAbort = abort;
    this.speaking = true;

    try {
      for await (const samples of streamElevenLabsPcm({
        apiKey: this.keys.elevenLabsApiKey,
        voiceId: this.context.voiceId,
        text,
        languageCode: this.context.languageCode,
        abortSignal: abort.signal,
      })) {
        if (abort.signal.aborted || this.muted) break;
        this.enqueuePcm(samples);
      }

      // Wait for queued audio to drain.
      while (
        this.pcmQueue.length > 0 &&
        !abort.signal.aborted &&
        !this.muted &&
        !this.closed
      ) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    } catch (error) {
      if (!abort.signal.aborted) {
        console.error(
          "[livekit-voice-agent] TTS failed",
          error instanceof Error ? error.message : error,
        );
      }
    } finally {
      if (this.ttsAbort === abort) {
        this.ttsAbort = null;
      }
      this.speaking = false;
    }
  }

  private enqueuePcm(samples: Int16Array): void {
    let offset = 0;
    while (offset < samples.length) {
      const end = Math.min(offset + FRAME_SAMPLES, samples.length);
      this.pcmQueue.push(samples.subarray(offset, end));
      offset = end;
    }
  }

  private startSilencePump(): void {
    const silence = new Int16Array(FRAME_SAMPLES);

    this.pumpTimer = setInterval(() => {
      if (!this.audioSource || this.closed) return;

      const next = this.pcmQueue.shift() ?? silence;
      const frameSamples =
        next.length >= FRAME_SAMPLES
          ? next.subarray(0, FRAME_SAMPLES)
          : (() => {
              const padded = new Int16Array(FRAME_SAMPLES);
              padded.set(next);
              return padded;
            })();

      try {
        void this.audioSource.captureFrame(
          new AudioFrame(frameSamples, SAMPLE_RATE, 1, FRAME_SAMPLES),
        );
      } catch {
        // ignore frame capture races during teardown
      }
    }, 20);
  }
}
