import type { ProcessingSettings, ProcessStats } from '../app/types';
import { computeEnergyEnvelope } from './energyEnvelope';
import { detectSilenceRegions } from './silenceDetector';
import { computeTrimBounds, sliceChannels, type TrimBounds } from './trim';
import { downmixToMono } from './mono';
import { speedUp } from './speedResample';
import { getTargetSampleRate, resampleToRate } from './sampleRateResample';
import { encodeWav } from './wavEncoder';
import { encodeMp3 } from './mp3Encoder';
import { buildOutputFilename } from './naming';

export interface PipelineInput {
  channels: Float32Array[];
  sampleRate: number;
  extension: string;
  baseName: string;
  settings: ProcessingSettings;
  originalBytes: number;
  /** User-dragged trim points (source samples, end exclusive); overrides auto-detection. */
  manualTrim?: { start: number; end: number };
  onStage?: (stage: 'trim' | 'downmix' | 'speedup' | 'resample' | 'encode') => void;
  isCancelled?: () => boolean;
}

export interface PipelineOutput {
  bytes: Uint8Array;
  outputName: string;
  outputExtension: string;
  stats: ProcessStats;
  warning?: string;
}

/**
 * Auto-detected trim bounds — the single code path shared by the worker
 * pipeline, the waveform editor's handles, and the batch size estimate.
 */
export function computeAutoTrimBounds(
  channels: Float32Array[],
  sampleRate: number,
  settings: Pick<ProcessingSettings, 'thresholdDb' | 'minDurationMs' | 'paddingMs'>,
): TrimBounds {
  const energy = computeEnergyEnvelope(channels);
  const regions = detectSilenceRegions(energy, sampleRate, settings.thresholdDb, settings.minDurationMs);
  return computeTrimBounds(channels[0]?.length ?? 0, regions, sampleRate, settings.paddingMs);
}

export function clampManualTrim(trim: { start: number; end: number }, totalLength: number): TrimBounds {
  const start = Math.max(0, Math.min(totalLength, Math.round(trim.start)));
  const end = Math.max(start, Math.min(totalLength, Math.round(trim.end)));
  if (end - start <= 0) {
    return { start: 0, end: totalLength, warning: 'Manual trim selected no audio — not trimmed.' };
  }
  return { start, end };
}

/**
 * The audible part of the pipeline (trim -> mono -> speed -> WAV
 * sample-rate reduction) without encoding, for the waveform editor's
 * live "Play Processed" preview before a batch is run.
 */
export async function renderPreview(
  channels: Float32Array[],
  sampleRate: number,
  bounds: TrimBounds,
  extension: string,
  settings: ProcessingSettings,
): Promise<{ channels: Float32Array[]; sampleRate: number }> {
  let out = sliceChannels(channels, bounds);
  if (!settings.preserveStereo) out = downmixToMono(out);
  if (settings.speedMultiplier > 1.0) out = speedUp(out, settings.speedMultiplier);
  let rate = sampleRate;
  if (extension !== 'mp3' && settings.bitrateKbps < 320 && (out[0]?.length ?? 0) > 0) {
    rate = getTargetSampleRate(settings.bitrateKbps);
    out = await resampleToRate(out, sampleRate, rate);
  }
  return { channels: out, sampleRate: rate };
}

/**
 * Orchestrates decode(already done by caller) -> trim -> mono/stereo ->
 * speed-up -> sample-rate/bitrate reduction -> encode, in that fixed order.
 * Browser-native containers we have encoders for are wav and mp3; any
 * other decodable input (flac/aiff/m4a/ogg) has no browser-side re-encoder
 * available without a heavy new dependency, so it is written out as WAV
 * (lossless, and every target hardware sampler accepts WAV natively).
 */
export async function runPipeline(input: PipelineInput): Promise<PipelineOutput> {
  const { settings } = input;
  const originalDurationSec = (input.channels[0]?.length ?? 0) / input.sampleRate;

  input.onStage?.('trim');
  const bounds = input.manualTrim
    ? clampManualTrim(input.manualTrim, input.channels[0]?.length ?? 0)
    : computeAutoTrimBounds(input.channels, input.sampleRate, settings);
  let channels = sliceChannels(input.channels, bounds);

  input.onStage?.('downmix');
  if (!settings.preserveStereo) {
    channels = downmixToMono(channels);
  }

  input.onStage?.('speedup');
  if (settings.speedMultiplier > 1.0) {
    channels = speedUp(channels, settings.speedMultiplier);
  }

  const outputExtension = input.extension === 'mp3' ? 'mp3' : 'wav';

  let sampleRate = input.sampleRate;
  let targetSampleRate: number | undefined;
  if (outputExtension === 'wav' && settings.bitrateKbps < 320) {
    targetSampleRate = getTargetSampleRate(settings.bitrateKbps);
    input.onStage?.('resample');
    channels = await resampleToRate(channels, sampleRate, targetSampleRate);
    sampleRate = targetSampleRate;
  }

  input.onStage?.('encode');
  const bytes =
    outputExtension === 'mp3'
      ? encodeMp3(channels, sampleRate, settings.bitrateKbps, input.isCancelled)
      : encodeWav(channels, sampleRate);

  const finalDurationSec = (channels[0]?.length ?? 0) / sampleRate;
  const outputName = buildOutputFilename({
    baseName: input.baseName,
    extension: outputExtension,
    preserveStereo: settings.preserveStereo,
    bitrateKbps: settings.bitrateKbps,
    targetSampleRate,
    finalDurationSec,
  });

  const stats: ProcessStats = {
    originalBytes: input.originalBytes,
    outputBytes: bytes.length,
    originalDurationSec,
    outputDurationSec: finalDurationSec,
    longerThan20s: finalDurationSec > 20,
  };

  return { bytes, outputName, outputExtension, stats, warning: bounds.warning };
}
