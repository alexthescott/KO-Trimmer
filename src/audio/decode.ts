import { getSharedContext } from './audioContext';
import { channelsOf, type PcmAudio } from './channels';

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
export async function decodeAudioFile(arrayBuffer: ArrayBuffer, nativeSampleRate?: number): Promise<PcmAudio> {
  const ctx = decodeContextFor(nativeSampleRate);
  // decodeAudioData detaches/consumes the buffer, so pass a copy if the
  // caller still needs the original bytes afterward.
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  return { channels: channelsOf(audioBuffer), sampleRate: audioBuffer.sampleRate };
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
