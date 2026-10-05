import { encodeMp3 } from '../audio/mp3Encoder';

export interface Mp3PreviewRequest {
  id: number;
  channels: Float32Array[];
  sampleRate: number;
  kbps: number;
}

export type Mp3PreviewResponse = { id: number; bytes: Uint8Array } | { id: number; error: string };

/** Encodes the editor's processed preview to MP3 off the main thread. */
self.onmessage = (event: MessageEvent<Mp3PreviewRequest>) => {
  const { id, channels, sampleRate, kbps } = event.data;
  try {
    const bytes = encodeMp3(channels, sampleRate, kbps);
    (self as unknown as Worker).postMessage({ id, bytes } satisfies Mp3PreviewResponse, { transfer: [bytes.buffer] });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: err instanceof Error ? err.message : String(err) } satisfies Mp3PreviewResponse);
  }
};
