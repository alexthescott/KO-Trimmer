import { decodeAudioFile } from './decode';
import type { PcmAudio } from './channels';
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
 * the batch output will have. Channels may be views of the editor's source
 * audio, so each is copied into its own buffer and that copy transferred —
 * posting a view would structured-clone its whole backing buffer.
 */
export async function mp3RoundTrip(channels: Float32Array[], sampleRate: number, kbps: number): Promise<PcmAudio> {
  const id = nextId++;
  const bytes = await new Promise<Uint8Array>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const copies = channels.map((channel) => channel.slice());
    getWorker().postMessage({ id, channels: copies, sampleRate, kbps } satisfies Mp3PreviewRequest, {
      transfer: copies.map((c) => c.buffer),
    });
  });
  // Decode at the encoded rate so the preview isn't resampled to the device rate.
  return decodeAudioFile(bytes.buffer as ArrayBuffer, sampleRate);
}
