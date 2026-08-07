import { AudioFrame, AudioSource } from "@livekit/rtc-node";

const SAMPLE_RATE = 16_000;
const FRAME_SAMPLES = 320; // 20ms @ 16kHz
const FRAME_INTERVAL_MS = 20;
const MAX_QUEUED_FRAMES = 500; // ~10s cap

/** Copy PCM into owned little-endian Int16 samples (never share ArrayBuffer views). */
export function copyPcm16(samples: Int16Array): Int16Array {
  const copy = new Int16Array(samples.length);
  copy.set(samples);
  return copy;
}

export function pcmFromBytes(bytes: Uint8Array): Int16Array {
  const usable = bytes.byteLength - (bytes.byteLength % 2);
  if (usable <= 0) {
    return new Int16Array(0);
  }

  // Copy via DataView so odd byteOffsets never corrupt frames.
  const view = new DataView(bytes.buffer, bytes.byteOffset, usable);
  const samples = new Int16Array(usable / 2);
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] = view.getInt16(i * 2, true);
  }
  return samples;
}

/**
 * LiveKit outbound PCM pacer: owns every frame, drains at realtime,
 * and never reuses ElevenLabs chunk buffers (fixes garbled "rrrrr" audio).
 */
export class LiveKitAudioOut {
  private readonly queue: Int16Array[] = [];
  private timer: NodeJS.Timeout | null = null;
  private closed = false;
  private speaking = false;
  private leftover = new Int16Array(0);

  constructor(private readonly source: AudioSource) {
    this.ensurePump();
  }

  get isSpeaking(): boolean {
    return this.speaking || this.queue.length > 0;
  }

  get queuedFrames(): number {
    return this.queue.length;
  }

  enqueue(samples: Int16Array): void {
    if (this.closed || samples.length === 0) return;

    const owned = copyPcm16(samples);
    let offset = 0;

    if (this.leftover.length > 0) {
      const need = FRAME_SAMPLES - this.leftover.length;
      const take = Math.min(need, owned.length);
      const merged = new Int16Array(this.leftover.length + take);
      merged.set(this.leftover);
      merged.set(owned.subarray(0, take), this.leftover.length);
      offset = take;

      if (merged.length === FRAME_SAMPLES) {
        this.pushFrame(merged);
        this.leftover = new Int16Array(0);
      } else {
        this.leftover = merged;
        return;
      }
    }

    while (offset + FRAME_SAMPLES <= owned.length) {
      this.pushFrame(owned.slice(offset, offset + FRAME_SAMPLES));
      offset += FRAME_SAMPLES;
    }

    if (offset < owned.length) {
      this.leftover = owned.slice(offset);
    }

    this.speaking = true;
    this.ensurePump();
  }

  clear(): void {
    this.queue.length = 0;
    this.leftover = new Int16Array(0);
    this.speaking = false;
  }

  async waitUntilDrained(abortSignal?: AbortSignal): Promise<void> {
    while (
      !this.closed &&
      (this.queue.length > 0 || this.leftover.length > 0) &&
      !abortSignal?.aborted
    ) {
      await sleep(FRAME_INTERVAL_MS);
    }

    // Flush a final partial frame as silence-padded audio.
    if (!this.closed && this.leftover.length > 0 && !abortSignal?.aborted) {
      const padded = new Int16Array(FRAME_SAMPLES);
      padded.set(this.leftover);
      this.leftover = new Int16Array(0);
      this.pushFrame(padded);
      while (this.queue.length > 0 && !abortSignal?.aborted && !this.closed) {
        await sleep(FRAME_INTERVAL_MS);
      }
    }

    this.speaking = false;
  }

  close(): void {
    this.closed = true;
    this.clear();
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private pushFrame(frame: Int16Array): void {
    if (this.queue.length >= MAX_QUEUED_FRAMES) {
      this.queue.shift();
    }
    this.queue.push(frame);
  }

  private ensurePump(): void {
    if (this.timer || this.closed) return;

    this.timer = setInterval(() => {
      if (this.closed) return;

      const frame = this.queue.shift();
      if (!frame) {
        // Idle: do not spam silence forever (was a source of buzz).
        if (!this.speaking) return;
        return;
      }

      try {
        // Always pass a fresh owned buffer into LiveKit.
        const owned = copyPcm16(frame);
        void this.source.captureFrame(
          new AudioFrame(owned, SAMPLE_RATE, 1, FRAME_SAMPLES),
        );
      } catch {
        // ignore teardown races
      }

      if (this.queue.length === 0 && this.leftover.length === 0) {
        this.speaking = false;
      }
    }, FRAME_INTERVAL_MS);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { SAMPLE_RATE, FRAME_SAMPLES };
