import {
  AudioSource,
  AudioStream,
  LocalAudioTrack,
  Room,
  RoomEvent,
  TrackKind,
  TrackPublishOptions,
  TrackSource,
  type RemoteParticipant,
  type RemoteTrack,
} from "@livekit/rtc-node";

import { LiveKitAudioOut, SAMPLE_RATE, copyPcm16 } from "./audio-out.js";
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

/** Ignore echo / barge-in for a short window after AI finishes speaking. */
const ECHO_GUARD_MS = 700;
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
  private audioOut: LiveKitAudioOut | null = null;
  private deepgram: DeepgramPcmSession | null = null;
  private context: VoiceStreamContext | null = null;
  private muted = false;
  private closed = false;
  private turnInFlight = false;
  private ttsAbort: AbortController | null = null;
  private echoGuardUntil = 0;
  private visitorTrackActive = false;

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

    room.on(
      RoomEvent.TrackSubscribed,
      (track, _publication, participant) => {
        void this.handleTrackSubscribed(track, participant);
      },
    );

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
    this.audioOut = new LiveKitAudioOut(this.audioSource);
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
        // Do not barge-in on speaker echo while / just after AI talks.
        if (this.shouldIgnoreInboundSpeech()) return;
        this.interruptSpeech();
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
    this.audioOut?.close();
    this.audioOut = null;

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

  private shouldIgnoreInboundSpeech(): boolean {
    if (this.audioOut?.isSpeaking) return true;
    if (Date.now() < this.echoGuardUntil) return true;
    return false;
  }

  private isVisitorParticipant(participant: RemoteParticipant | undefined): boolean {
    const identity = participant?.identity ?? "";
    return identity.startsWith("visitor_");
  }

  private async handleTrackSubscribed(
    track: RemoteTrack,
    participant: RemoteParticipant,
  ): Promise<void> {
    if (this.closed || this.muted) return;
    if (track.kind !== TrackKind.KIND_AUDIO) return;

    // Only listen to the customer mic — ignore staff/monitor tracks for STT.
    if (!this.isVisitorParticipant(participant)) {
      console.info(
        "[livekit-voice-agent] skip non-visitor audio",
        participant.identity,
      );
      return;
    }

    if (this.visitorTrackActive) {
      // Avoid double-subscribing the same caller track.
      return;
    }
    this.visitorTrackActive = true;

    const stream = new AudioStream(track, SAMPLE_RATE, 1);
    const reader = stream.getReader();

    try {
      while (!this.closed && !this.muted) {
        const { done, value } = await reader.read();
        if (done || !value) break;

        if (this.shouldIgnoreInboundSpeech()) {
          continue;
        }

        // Copy before sending — LiveKit may reuse frame buffers.
        this.deepgram?.sendPcm(copyPcm16(value.data));
      }
    } catch (error) {
      console.warn(
        "[livekit-voice-agent] audio stream ended",
        error instanceof Error ? error.message : "unknown",
      );
    } finally {
      this.visitorTrackActive = false;
      reader.releaseLock();
    }
  }

  private async handleUserTranscript(text: string): Promise<void> {
    if (this.closed || this.muted || this.turnInFlight) return;
    if (this.shouldIgnoreInboundSpeech()) return;

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
    this.audioOut?.clear();
    this.echoGuardUntil = Date.now() + ECHO_GUARD_MS;
  }

  private async speak(text: string): Promise<void> {
    if (this.closed || this.muted || !this.context || !this.audioOut) return;

    this.interruptSpeech();
    const abort = new AbortController();
    this.ttsAbort = abort;

    try {
      for await (const samples of streamElevenLabsPcm({
        apiKey: this.keys.elevenLabsApiKey,
        voiceId: this.context.voiceId,
        text,
        languageCode: this.context.languageCode,
        abortSignal: abort.signal,
      })) {
        if (abort.signal.aborted || this.muted) break;
        this.audioOut.enqueue(samples);
      }

      await this.audioOut.waitUntilDrained(abort.signal);
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
      this.echoGuardUntil = Date.now() + ECHO_GUARD_MS;
    }
  }
}
