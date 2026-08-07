"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
  type LocalAudioTrack,
  type RemoteTrack,
} from "livekit-client";
import {
  HeadphonesIcon,
  Loader2Icon,
  PhoneForwardedIcon,
  PhoneOffIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { INTERNET_PHONE_MESSAGES } from "@/features/internet-phone/constants";
import type {
  InternetPhoneLiveCall,
  InternetPhoneStaffTokenResponse,
} from "@/types/internet-phone.types";

type StaffPhase = "idle" | "connecting" | "listening" | "talking";

type InternetPhoneStaffCallPanelProps = {
  call: InternetPhoneLiveCall;
  onEnded?: () => void;
};

function attachRemoteAudio(track: RemoteTrack, container: HTMLDivElement) {
  const element = track.attach() as HTMLAudioElement;
  element.autoplay = true;
  element.setAttribute("playsinline", "true");
  element.className = "hidden";
  container.appendChild(element);
}

export function InternetPhoneStaffCallPanel({
  call,
  onEnded,
}: InternetPhoneStaffCallPanelProps) {
  const [phase, setPhase] = useState<StaffPhase>("idle");
  const [room, setRoom] = useState<Room | null>(null);
  const [micTrack, setMicTrack] = useState<LocalAudioTrack | null>(null);
  const audioHostRef = useRef<HTMLDivElement | null>(null);

  const cleanup = useCallback(async () => {
    micTrack?.stop();
    setMicTrack(null);
    await room?.disconnect();
    setRoom(null);
    if (audioHostRef.current) {
      audioHostRef.current.innerHTML = "";
    }
  }, [micTrack, room]);

  useEffect(() => {
    return () => {
      void cleanup();
    };
  }, [cleanup]);

  const join = useCallback(
    async (mode: "listen" | "talk") => {
      setPhase("connecting");

      try {
        if (mode === "talk") {
          const handoffResponse = await fetch(
            `/api/internet-phone/calls/${call.id}/handoff`,
            { method: "POST" },
          );
          if (!handoffResponse.ok) {
            const body = (await handoffResponse.json().catch(() => null)) as {
              error?: string;
            } | null;
            throw new Error(
              body?.error || INTERNET_PHONE_MESSAGES.handoffFailed,
            );
          }
        }

        const tokenResponse = await fetch(
          `/api/internet-phone/calls/${call.id}/staff-token`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode }),
          },
        );

        if (!tokenResponse.ok) {
          const body = (await tokenResponse.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(
            body?.error || INTERNET_PHONE_MESSAGES.staffTokenFailed,
          );
        }

        const payload =
          (await tokenResponse.json()) as InternetPhoneStaffTokenResponse;

        await cleanup();

        const nextRoom = new Room({ adaptiveStream: true, dynacast: true });
        nextRoom.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind !== Track.Kind.Audio || !audioHostRef.current) return;
          attachRemoteAudio(track, audioHostRef.current);
        });
        nextRoom.on(RoomEvent.Disconnected, () => {
          setPhase("idle");
          setRoom(null);
          onEnded?.();
        });

        await nextRoom.connect(payload.livekitUrl, payload.token);

        for (const participant of nextRoom.remoteParticipants.values()) {
          for (const publication of participant.trackPublications.values()) {
            if (
              publication.track &&
              publication.track.kind === Track.Kind.Audio &&
              audioHostRef.current
            ) {
              attachRemoteAudio(publication.track, audioHostRef.current);
            }
          }
        }

        if (mode === "talk") {
          const audioTrack = await createLocalAudioTrack();
          await nextRoom.localParticipant.publishTrack(audioTrack, {
            source: Track.Source.Microphone,
          });
          setMicTrack(audioTrack);
          setPhase("talking");
          toast.success(INTERNET_PHONE_MESSAGES.handoffSuccess);
        } else {
          setPhase("listening");
        }

        setRoom(nextRoom);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : INTERNET_PHONE_MESSAGES.staffTokenFailed;
        toast.error(message);
        setPhase("idle");
      }
    },
    [call.id, cleanup, onEnded],
  );

  const leave = useCallback(async () => {
    await cleanup();
    setPhase("idle");
  }, [cleanup]);

  const endCall = useCallback(async () => {
    const response = await fetch(`/api/internet-phone/calls/${call.id}/end`, {
      method: "POST",
    });
    if (!response.ok) {
      toast.error(INTERNET_PHONE_MESSAGES.endCallFailed);
      return;
    }
    await cleanup();
    setPhase("idle");
    onEnded?.();
  }, [call.id, cleanup, onEnded]);

  return (
    <div className="space-y-3 rounded-xl border bg-background/70 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={call.staffRequested ? "destructive" : "secondary"}>
          {call.callMode === "handoff" || call.humanHandled
            ? "Human"
            : call.aiStatus === "active" || call.aiStatus === "joining"
              ? "AI"
              : call.aiStatus}
        </Badge>
        {call.staffRequested ? (
          <Badge variant="outline">Staff requested</Badge>
        ) : null}
        <span className="text-xs text-muted-foreground">
          {new Date(call.startedAt).toLocaleTimeString()}
        </span>
      </div>

      <p className="text-sm text-muted-foreground">
        {phase === "listening"
          ? INTERNET_PHONE_MESSAGES.staffListening
          : phase === "talking"
            ? INTERNET_PHONE_MESSAGES.staffTalking
            : phase === "connecting"
              ? INTERNET_PHONE_MESSAGES.staffConnecting
              : `Caller ${call.visitorId.slice(0, 8)} · room ready`}
      </p>

      <div className="flex flex-wrap gap-2">
        {phase === "idle" ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void join("listen")}
            >
              <HeadphonesIcon className="size-4" />
              {INTERNET_PHONE_MESSAGES.listenIn}
            </Button>
            <Button type="button" size="sm" onClick={() => void join("talk")}>
              <PhoneForwardedIcon className="size-4" />
              {INTERNET_PHONE_MESSAGES.takeOver}
            </Button>
          </>
        ) : null}

        {phase === "connecting" ? (
          <Button type="button" size="sm" disabled>
            <Loader2Icon className="size-4 animate-spin" />
            {INTERNET_PHONE_MESSAGES.staffConnecting}
          </Button>
        ) : null}

        {phase === "listening" ? (
          <>
            <Button type="button" size="sm" onClick={() => void join("talk")}>
              <PhoneForwardedIcon className="size-4" />
              {INTERNET_PHONE_MESSAGES.takeOver}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void leave()}>
              {INTERNET_PHONE_MESSAGES.leaveCall}
            </Button>
          </>
        ) : null}

        {phase === "talking" ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => void endCall()}
            >
              <PhoneOffIcon className="size-4" />
              {INTERNET_PHONE_MESSAGES.endCall}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void leave()}>
              {INTERNET_PHONE_MESSAGES.leaveCall}
            </Button>
          </>
        ) : null}
      </div>

      <div ref={audioHostRef} className="hidden" aria-hidden />
    </div>
  );
}
