import type { ProcessingSettings, ProcessingStage, ProcessStats, SampleRange } from '../app/types';
import { computeEnergyEnvelope } from './energyEnvelope';
import { detectSilenceRegions } from './silenceDetector';
import { computeTrimBounds, sliceChannels, type TrimBounds } from './trim';
import { downmixToMono } from './mono';
import { speedUp } from './speedResample';
import { resolveWavSampleRate, resampleToRate } from './sampleRateResample';
import { encodeWav } from './wavEncoder';
import { encodeMp3 } from './mp3Encoder';
import { buildOutputFilename, exceedsKoIILength } from './naming';
import { peakAbs, type SampleFormat } from './sampleFormat';
import { frameCount } from './channels';
import { chooseOutputFormat, outputContainerFor, type OutputContainer } from './outputContainer';

/** Everything the pipeline needs about one file — serializable, so it can cross to the worker. */
export interface PipelineRequest {
  channels: Float32Array[];
  sampleRate: number;
  extension: string;
  baseName: string;
  settings: ProcessingSettings;
  originalBytes: number;
  /** Source bit depth from the file header, if known. */
  sourceFormat?: SampleFormat;
  /** User-dragged trim points; overrides auto-detection. */
  manualTrim?: SampleRange;
}

export interface PipelineInput extends PipelineRequest {
  onStage?: (stage: ProcessingStage) => void;
  isCancelled?: () => boolean;
}

export interface PipelineOutput {
  bytes: Uint8Array;
  outputName: string;
  outputExtension: OutputContainer;
  stats: ProcessStats;
  warning?: string;
}

export interface RenderedAudio {
  channels: Float32Array[];
  sampleRate: number;
}

export interface RenderInput extends RenderedAudio {
  bounds: SampleRange;
  container: OutputContainer;
  settings: ProcessingSettings;
  onStage?: (stage: ProcessingStage) => void;
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
  return computeTrimBounds(frameCount(channels), regions, sampleRate, settings.paddingMs);
}

export function clampManualTrim(trim: SampleRange, totalLength: number): TrimBounds {
  const start = Math.max(0, Math.min(totalLength, Math.round(trim.start)));
  const end = Math.max(start, Math.min(totalLength, Math.round(trim.end)));
  if (end - start <= 0) {
    return { start: 0, end: totalLength, warning: 'Manual trim selected no audio — not trimmed.' };
  }
  return { start, end };
}

/**
 * The audible stages (trim -> mono -> speed-up -> WAV sample-rate reduction)
 * without encoding. runPipeline encodes its result, and the waveform editor
 * plays it as the live "Play Processed" preview — one code path, so the
 * preview can't drift from the batch output.
 */
export async function renderAudible(input: RenderInput): Promise<RenderedAudio> {
  const { settings, onStage } = input;
  let channels = sliceChannels(input.channels, input.bounds);

  onStage?.('downmix');
  if (!settings.preserveStereo) channels = downmixToMono(channels);

  onStage?.('speedup');
  if (settings.speedMultiplier > 1.0) channels = speedUp(channels, settings.speedMultiplier);

  const targetSampleRate =
    input.container === 'wav' ? resolveWavSampleRate(input.sampleRate, settings.wavSampleRateHz) : undefined;
  if (targetSampleRate === undefined || frameCount(channels) === 0) {
    return { channels, sampleRate: input.sampleRate };
  }
  onStage?.('resample');
  return { channels: await resampleToRate(channels, input.sampleRate, targetSampleRate), sampleRate: targetSampleRate };
}

/**
 * Orchestrates decode (already done by caller) -> trim -> mono/stereo ->
 * speed-up -> sample-rate reduction -> encode, in that fixed order.
 */
export async function runPipeline(input: PipelineInput): Promise<PipelineOutput> {
  const { settings } = input;
  const container = outputContainerFor(input.extension);

  input.onStage?.('trim');
  const bounds = input.manualTrim
    ? clampManualTrim(input.manualTrim, frameCount(input.channels))
    : computeAutoTrimBounds(input.channels, input.sampleRate, settings);
  const rendered = await renderAudible({ ...input, bounds, container });

  input.onStage?.('encode');
  const { format: outputFormat, clipNote } = chooseOutputFormat(
    container,
    input.sourceFormat,
    settings.preserveBitDepth,
    container === 'wav' ? peakAbs(rendered.channels) : undefined,
  );
  const bytes =
    container === 'mp3'
      ? encodeMp3(rendered.channels, rendered.sampleRate, settings.bitrateKbps, input.isCancelled)
      : encodeWav(rendered.channels, rendered.sampleRate, outputFormat);

  const finalDurationSec = frameCount(rendered.channels) / rendered.sampleRate;
  const outputName = buildOutputFilename({
    baseName: input.baseName,
    extension: container,
    preserveStereo: settings.preserveStereo,
    bitrateKbps: settings.bitrateKbps,
    targetSampleRate: rendered.sampleRate !== input.sampleRate ? rendered.sampleRate : undefined,
    finalDurationSec,
  });

  const stats: ProcessStats = {
    originalBytes: input.originalBytes,
    outputBytes: bytes.length,
    originalDurationSec: frameCount(input.channels) / input.sampleRate,
    outputDurationSec: finalDurationSec,
    exceedsKoIILength: exceedsKoIILength(finalDurationSec),
    keptFloatToAvoidClipping: clipNote !== undefined,
    sourceFormat: outputFormat && input.sourceFormat,
    outputFormat,
  };

  const warning = [bounds.warning, clipNote].filter(Boolean).join(' · ') || undefined;
  return { bytes, outputName, outputExtension: container, stats, warning };
}
