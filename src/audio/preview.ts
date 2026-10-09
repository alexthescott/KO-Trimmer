import { decodeAudioFile } from './decode';
import type { PcmAudio } from './channels';
import type { RenderInput } from './pipeline';
import type { PreviewRequest, PreviewResponse } from '../workers/protocol';

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, { resolve: (response: PreviewResponse) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('../workers/preview.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<PreviewResponse>) => {
    pending.get(event.data.id)?.resolve(event.data);
    pending.delete(event.data.id);
  };
  return worker;
}

/**
 * Renders the editor's "Play Processed" preview in a worker — the same
 * renderAudible as the batch, plus the real MP3 encoder below full bitrate.
 * Only the kept range is sent, as a copy (the source is the editor's cached
 * decode, which a transfer would detach).
 */
export async function renderPreview(input: RenderInput): Promise<PcmAudio> {
  const { start, end } = input.bounds;
  const channels = input.channels.map((c) => c.slice(start, end));
  const request: PreviewRequest = {
    id: nextId++,
    input: {
      channels,
      sampleRate: input.sampleRate,
      bounds: { start: 0, end: end - start },
      container: input.container,
      settings: input.settings,
    },
  };
  const response = await new Promise<PreviewResponse>((resolve) => {
    pending.set(request.id, { resolve });
    getWorker().postMessage(request, { transfer: channels.map((c) => c.buffer) });
  });
  if ('error' in response) throw new Error(response.error);
  const { result } = response;
  // Decode at the encoded rate so the preview isn't resampled to the device rate.
  return result.kind === 'pcm' ? result.audio : decodeAudioFile(result.bytes.buffer as ArrayBuffer, result.sampleRate);
}
