import type { BitrateKbps, ProcessingSettings } from '../app/types';
import { getTargetSampleRate } from './sampleRateResample';

export interface EstimateInput {
  /** Frames kept after trim, at the source sample rate. */
  trimmedFrames: number;
  sourceChannels: number;
  sourceSampleRate: number;
  extension: string;
  settings: Pick<ProcessingSettings, 'speedMultiplier' | 'preserveStereo' | 'bitrateKbps'>;
}

/**
 * Predicts output bytes with the same rules runPipeline applies after the
 * trim: mono downmix, speed-up length rounding, WAV sample-rate reduction
 * as a bitrate proxy, then 16-bit PCM WAV (44-byte header) or CBR MP3.
 * Ported from the JUCE KOTrimmer's estimateOutputSize.
 */
export function estimateOutputBytes(input: EstimateInput): number {
  const { settings } = input;
  const channels = settings.preserveStereo ? input.sourceChannels : Math.min(1, input.sourceChannels);

  let frames = input.trimmedFrames;
  if (settings.speedMultiplier > 1.0 && frames > 0) {
    frames = Math.max(1, Math.round(frames / settings.speedMultiplier));
  }

  if (input.extension === 'mp3') {
    const durationSec = frames / input.sourceSampleRate;
    return Math.round((durationSec * settings.bitrateKbps * 1000) / 8);
  }

  let sampleRate = input.sourceSampleRate;
  if (settings.bitrateKbps < 320) {
    const target = getTargetSampleRate(settings.bitrateKbps as BitrateKbps);
    if (target !== sampleRate) {
      frames = Math.ceil((frames * target) / sampleRate);
      sampleRate = target;
    }
  }

  return 44 + frames * channels * 2;
}

export interface BatchEstimateSample {
  originalBytes: number;
  estimatedBytes: number;
}

/**
 * Extrapolates a whole-batch total from the files analysed so far, scaling
 * their output/input byte ratio to the remainder (files not yet analysed,
 * or that failed to decode).
 */
export function extrapolateBatchEstimate(
  samples: BatchEstimateSample[],
  totalOriginalBytes: number,
): number {
  if (samples.length === 0) return totalOriginalBytes;
  const sampledOriginal = samples.reduce((sum, s) => sum + s.originalBytes, 0);
  const sampledEstimate = samples.reduce((sum, s) => sum + s.estimatedBytes, 0);
  if (sampledOriginal <= 0) return sampledEstimate;
  const remainder = Math.max(0, totalOriginalBytes - sampledOriginal);
  return Math.round(sampledEstimate + remainder * (sampledEstimate / sampledOriginal));
}
