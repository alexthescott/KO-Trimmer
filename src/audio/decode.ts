import { getSharedContext } from './audioContext';

export interface DecodedAudio {
  channels: Float32Array[];
  sampleRate: number;
}

/**
 * Decodes a file's bytes via the Web Audio API. Runs on the main thread
 * (decodeAudioData is async/non-blocking) with per-file isolation: a
 * decode failure for one file must not abort the rest of the batch.
 *
 * decodeAudioData resamples to its context's rate, and a live AudioContext
 * runs at the output device's rate (often 48 kHz) — so with the file's
 * `nativeSampleRate` known, decode through an OfflineAudioContext at that
 * rate instead, keeping output identical across machines. Unknown rates
 * fall back to the device rate.
 */
export async function decodeAudioFile(arrayBuffer: ArrayBuffer, nativeSampleRate?: number): Promise<DecodedAudio> {
  const ctx = decodeContextFor(nativeSampleRate);
  // decodeAudioData detaches/consumes the buffer, so pass a copy if the
  // caller still needs the original bytes afterward.
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  const channels: Float32Array[] = [];
  for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
    channels.push(audioBuffer.getChannelData(i).slice());
  }
  return { channels, sampleRate: audioBuffer.sampleRate };
}

const MIN_CONTEXT_RATE = 3000;
const MAX_CONTEXT_RATE = 768000;

function decodeContextFor(sampleRate: number | undefined): BaseAudioContext {
  if (sampleRate && sampleRate >= MIN_CONTEXT_RATE && sampleRate <= MAX_CONTEXT_RATE) {
    try {
      return new OfflineAudioContext(1, 1, sampleRate);
    } catch {
      // Rate unsupported by this browser — fall through to the device rate.
    }
  }
  return getSharedContext();
}
