"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
  type LocalAudioTrack,
  type RemoteTrack,
} from "livekit-client";
import { Loader2Icon, PhoneIcon, PhoneOffIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { INTERNET_PHONE_MESSAGES } from "@/features/internet-phone/constants";
import type {
  InternetPhoneTokenResponse,
  PublicInternetPhonePageData,
} from "@/types/internet-phone.types";

type PublicCallClientProps = {
  page: PublicInternetPhonePageData;
};

function getOrCreateVisitorId(): string {
  const key = "orzu_internet_phone_visitor";
  try {
    const existing = window.localStorage.getItem(key);
    if (existing && existing.length >= 8) return existing;
    const next = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
    window.localStorage.setItem(key, next);
    return next;
  } catch {
    return `tmp_${Date.now().toString(36)}`;
  }
}

function attachRemoteAudio(track: RemoteTrack, container: HTMLDivElement) {
  const element = track.attach() as HTMLAudioElement;
  element.autoplay = true;
  element.setAttribute("playsinline", "true");
  element.className = "hidden";
  container.appendChild(element);
}

export function PublicCallClient({ page }: PublicCallClientProps) {
  const [phase, setPhase] = useState<"idle" | "connecting" | "live" | "ended">(
    "idle",
  );
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [micTrack, setMicTrack] = useState<LocalAudioTrack | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const audioHostRef = useRef<HTMLDivElement | null>(null);

  const accent = useMemo(
    () => page.primaryColor || "#0F766E",
    [page.primaryColor],
  );

  const hangUp = useCallback(async () => {
    if (callId) {
      void fetch(`/api/public/call/${page.publicId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId }),
      }).catch(() => undefined);
    }

    micTrack?.stop();
    setMicTrack(null);
    await room?.disconnect();
    setRoom(null);
    setCallId(null);
    setStatusLabel(null);
    if (audioHostRef.current) {
      audioHostRef.current.innerHTML = "";
    }
    setPhase("ended");
  }, [callId, micTrack, page.publicId, room]);

  const startCall = useCallback(async () => {
    setPhase("connecting");
    setStatusLabel(INTERNET_PHONE_MESSAGES.aiConnecting);

    try {
      const visitorId = getOrCreateVisitorId();
      const response = await fetch(`/api/public/call/${page.publicId}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error || "Unable to start call");
      }

      const payload = (await response.json()) as InternetPhoneTokenResponse;
      setCallId(payload.callId);

      const audioTrack = await createLocalAudioTrack();
      const nextRoom = new Room({ adaptiveStream: true, dynacast: true });

      nextRoom.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
        if (track.kind !== Track.Kind.Audio || !audioHostRef.current) return;
        attachRemoteAudio(track, audioHostRef.current);

        const identity = participant.identity ?? "";
        if (identity.startsWith("ai_")) {
          setStatusLabel(INTERNET_PHONE_MESSAGES.aiLive);
        } else if (identity.startsWith("staff_")) {
          setStatusLabel(INTERNET_PHONE_MESSAGES.humanLive);
        }
      });

      nextRoom.on(RoomEvent.Disconnected, () => {
        setPhase("ended");
        setRoom(null);
        setCallId(null);
        setStatusLabel(null);
      });

      await nextRoom.connect(payload.livekitUrl, payload.token);
      await nextRoom.localParticipant.publishTrack(audioTrack, {
        source: Track.Source.Microphone,
      });

      setMicTrack(audioTrack);
      setRoom(nextRoom);
      setPhase("live");

      if (payload.aiStatus === "joining" || payload.aiStatus === "active") {
        setStatusLabel(INTERNET_PHONE_MESSAGES.aiConnecting);
      } else {
        setStatusLabel("Connected — waiting for a team member");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : INTERNET_PHONE_MESSAGES.micDenied;
      toast.error(message);
      setPhase("idle");
      setStatusLabel(null);
    }
  }, [page.publicId]);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6 py-12"
      style={{
        background: `radial-gradient(circle at top, ${accent}22, #f8fafc 45%, #eef2f7)`,
      }}
    >
      <div className="w-full max-w-md rounded-3xl border bg-white/90 p-8 shadow-sm backdrop-blur">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
          Internet Phone
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
          {page.displayName}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {page.greetingMessage}
        </p>

        <div className="mt-8 flex flex-col gap-3">
          {phase === "idle" || phase === "ended" ? (
            <Button
              type="button"
              size="lg"
              className="h-12 text-base"
              style={{ backgroundColor: accent }}
              onClick={() => void startCall()}
            >
              <PhoneIcon className="size-4" />
              {INTERNET_PHONE_MESSAGES.callButton}
            </Button>
          ) : null}

          {phase === "connecting" ? (
            <Button type="button" size="lg" className="h-12" disabled>
              <Loader2Icon className="size-4 animate-spin" />
              {INTERNET_PHONE_MESSAGES.calling}
            </Button>
          ) : null}

          {phase === "live" ? (
            <>
              <p className="text-center text-sm font-medium text-emerald-700">
                {statusLabel || "Connected — speak now"}
              </p>
              <Button
                type="button"
                size="lg"
                variant="destructive"
                className="h-12"
                onClick={() => void hangUp()}
              >
                <PhoneOffIcon className="size-4" />
                End call
              </Button>
            </>
          ) : null}

          {phase === "ended" ? (
            <p className="text-center text-sm text-slate-500">
              {INTERNET_PHONE_MESSAGES.callEnded}
            </p>
          ) : null}
        </div>
        <div ref={audioHostRef} className="hidden" aria-hidden />
      </div>
    </div>
  );
}
