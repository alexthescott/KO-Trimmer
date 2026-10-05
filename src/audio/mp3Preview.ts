import { decodeAudioFile, type DecodedAudio } from './decode';
import type { Mp3PreviewRequest, Mp3PreviewResponse } from '../workers/mp3Preview.worker';

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, { resolve: (bytes: Uint8Array) => void; reject: (err: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('../workers/mp3Preview.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<Mp3PreviewResponse>) => {
    const entry = pending.get(event.data.id);
    if (!entry) return;
    pending.delete(event.data.id);
    if ('bytes' in event.data) entry.resolve(event.data.bytes);
    else entry.reject(new Error(event.data.error));
  };
  return worker;
}

/**
 * Encodes audio to MP3 at `kbps` (in a worker) and decodes it back, so the
 * editor's "Play Processed" preview carries the real compression artifacts
 * the batch output will have. Channels are copied, never transferred — they
 * may be views of the editor's source audio.
 */
export async function mp3RoundTrip(channels: Float32Array[], sampleRate: number, kbps: number): Promise<DecodedAudio> {
  const id = nextId++;
  const bytes = await new Promise<Uint8Array>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, channels, sampleRate, kbps } satisfies Mp3PreviewRequest);
  });
  return decodeAudioFile(bytes.buffer as ArrayBuffer);
}
