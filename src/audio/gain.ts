import { frameCount } from './channels';
import { peakAbs } from './sampleFormat';

/** Peak level Normalize brings audio to: just under full scale, leaving headroom for MP3 encoder overshoot. */
export const NORMALIZE_PEAK_DB = -0.3;
export const NORMALIZE_PEAK = Math.pow(10, NORMALIZE_PEAK_DB / 20);

/** Scales every channel so the absolute peak is `target` (up or down); silence is returned untouched. */
export function normalizePeak(channels: Float32Array[], target = NORMALIZE_PEAK): Float32Array[] {
  const peak = peakAbs(channels);
  if (peak === 0 || peak === target) return channels;
  const gain = target / peak;
  return channels.map((channel) => channel.map((v) => v * gain));
}

/** The output peak to predict clipping from: the source's, unless Normalize will move it to NORMALIZE_PEAK. */
export function predictedOutputPeak(sourcePeak: number, normalize: boolean): number {
  return normalize && sourcePeak > 0 ? NORMALIZE_PEAK : sourcePeak;
}

/**
 * Linear fade-in over the first `fadeInFrames` and fade-out over the last
 * `fadeOutFrames` (each capped at half the buffer) — kills the click a cut
 * mid-waveform leaves. Returns copies; the input is never written.
 */
export function fadeEdges(channels: Float32Array[], fadeInFrames: number, fadeOutFrames: number): Float32Array[] {
  const n = frameCount(channels);
  const fadeIn = Math.min(Math.round(fadeInFrames), Math.floor(n / 2));
  const fadeOut = Math.min(Math.round(fadeOutFrames), Math.floor(n / 2));
  if (fadeIn <= 0 && fadeOut <= 0) return channels;
  return channels.map((channel) => {
    const out = channel.slice();
    for (let i = 0; i < fadeIn; i++) out[i] *= i / fadeIn;
    for (let i = 0; i < fadeOut; i++) out[n - 1 - i] *= i / fadeOut;
    return out;
  });
}
