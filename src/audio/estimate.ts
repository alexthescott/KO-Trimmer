import type { ProcessingSettings } from '../app/types';
import { resampledFrames, resolveWavSampleRate } from './sampleRateResample';
import { semitonesToSpeed, speedUpFrames } from './speedResample';
import type { SampleFormat } from './sampleFormat';
import { wavHeaderBytes } from './wavEncoder';
import { aiffHeaderBytes } from './aiffEncoder';
import { chooseWavFormat, outputContainerFor } from './outputContainer';

export interface EstimateInput {
  /** Frames kept after trim, at the source sample rate. */
  trimmedFrames: number;
  sourceChannels: number;
  sourceSampleRate: number;
  extension: string;
  /** Source bit depth from the file header, if known. */
  sourceFormat?: SampleFormat;
  /** Absolute peak, if known: integer output that would clip is estimated as 32-bit float. */
  peak?: number;
  settings: Pick<ProcessingSettings, 'speedSemitones' | 'preserveStereo' | 'bitrateKbps'> &
    Partial<Pick<ProcessingSettings, 'preserveBitDepth' | 'wavSampleRateHz'>>;
}

/**
 * Predicts output bytes with the same rules runPipeline applies after the
 * trim: mono downmix, speed-up length rounding, WAV sample-rate reduction,
 * then WAV/AIFF at the resolved output bit depth or CBR MP3.
 * Ported from the JUCE KOTrimmer's estimateOutputSize.
 */
export function estimateOutputBytes(input: EstimateInput): number {
  const { settings } = input;
  const channels = settings.preserveStereo ? input.sourceChannels : Math.min(1, input.sourceChannels);

  let frames = speedUpFrames(input.trimmedFrames, semitonesToSpeed(settings.speedSemitones));

  const container = outputContainerFor(input.extension);
  if (container === 'mp3') {
    const durationSec = frames / input.sourceSampleRate;
    return Math.round((durationSec * settings.bitrateKbps * 1000) / 8);
  }

  const target = resolveWavSampleRate(input.sourceSampleRate, settings.wavSampleRateHz ?? null);
  if (target !== undefined) frames = resampledFrames(frames, input.sourceSampleRate, target);

  const { format } = chooseWavFormat(input.sourceFormat, settings.preserveBitDepth ?? false, input.peak);
  const headerBytes = container === 'aiff' ? aiffHeaderBytes(format) : wavHeaderBytes(format);
  const dataBytes = frames * channels * (format.bits / 8);
  return headerBytes + dataBytes + (container === 'aiff' ? dataBytes % 2 : 0);
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
export function extrapolateBatchEstimate(samples: BatchEstimateSample[], totalOriginalBytes: number): number {
  if (samples.length === 0) return totalOriginalBytes;
  const sampledOriginal = samples.reduce((sum, s) => sum + s.originalBytes, 0);
  const sampledEstimate = samples.reduce((sum, s) => sum + s.estimatedBytes, 0);
  if (sampledOriginal <= 0) return sampledEstimate;
  const remainder = Math.max(0, totalOriginalBytes - sampledOriginal);
  return Math.round(sampledEstimate + remainder * (sampledEstimate / sampledOriginal));
}
