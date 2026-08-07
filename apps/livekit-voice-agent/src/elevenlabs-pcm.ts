export async function* streamElevenLabsPcm(input: {
  apiKey: string;
  voiceId: string;
  text: string;
  languageCode?: string;
  abortSignal: AbortSignal;
}): AsyncGenerator<Int16Array, void, void> {
  const streamUrl = new URL(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(input.voiceId)}/stream`,
  );
  streamUrl.searchParams.set("output_format", "pcm_16000");
  streamUrl.searchParams.set("optimize_streaming_latency", "3");

  const response = await fetch(streamUrl.toString(), {
    method: "POST",
    headers: {
      "xi-api-key": input.apiKey,
      "Content-Type": "application/json",
      Accept: "audio/pcm",
    },
    body: JSON.stringify({
      text: input.text,
      model_id: "eleven_flash_v2_5",
      language_code: input.languageCode || undefined,
      voice_settings: {
        stability: 0.55,
        similarity_boost: 0.8,
        style: 0.15,
        use_speaker_boost: true,
      },
    }),
    signal: input.abortSignal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`ElevenLabs stream failed (${response.status})`);
  }

  const reader = response.body.getReader();
  let leftover = Buffer.alloc(0);

  while (!input.abortSignal.aborted) {
    const { done, value } = await reader.read();
    if (done || !value) break;

    const chunk = Buffer.concat([leftover, Buffer.from(value)]);
    const usable = chunk.byteLength - (chunk.byteLength % 2);
    if (usable <= 0) {
      leftover = chunk;
      continue;
    }

    const pcmBuffer = chunk.subarray(0, usable);
    leftover = chunk.subarray(usable);
    const samples = new Int16Array(
      pcmBuffer.buffer,
      pcmBuffer.byteOffset,
      pcmBuffer.byteLength / 2,
    );
    yield samples;
  }
}
