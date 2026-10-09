import type { ProcessingSettings, ProcessingStage, ProcessStats, SampleRange } from '../app/types';
import { sliceChannels, type TrimBounds } from './trim';
import { computeAutoTrimBounds } from './autoTrim';
import { downmixToMono } from './mono';
import { speedUp } from './speedResample';
import { resolveWavSampleRate, resampleToRate } from './sampleRateResample';
import { encodeWav } from './wavEncoder';
import { encodeMp3 } from './mp3Encoder';
import { buildOutputFilename, exceedsKoIILength } from './naming';
import { peakAbs, type SampleFormat } from './sampleFormat';
import { frameCount, type PcmAudio } from './channels';
import { fadeEdges, normalizePeak } from './gain';
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

export interface RenderInput extends PcmAudio {
  bounds: SampleRange;
  container: OutputContainer;
  settings: ProcessingSettings;
  onStage?: (stage: ProcessingStage) => void;
}

export function clampManualTrim(trim: SampleRange, totalFrames: number): TrimBounds {
  const start = Math.max(0, Math.min(totalFrames, Math.round(trim.start)));
  const end = Math.max(start, Math.min(totalFrames, Math.round(trim.end)));
  if (end - start <= 0) {
    return { start: 0, end: totalFrames, warning: 'Manual trim selected no audio — not trimmed.' };
  }
  return { start, end };
}

/**
 * The audible stages (trim -> fade -> mono -> speed-up -> WAV sample-rate
 * reduction -> normalize) without encoding. runPipeline encodes its result, and the waveform editor
 * plays it as the live "Play Processed" preview — one code path, so the
 * preview can't drift from the batch output.
 */
export async function renderAudible(input: RenderInput): Promise<PcmAudio> {
  const { settings, onStage, bounds } = input;
  let channels = sliceChannels(input.channels, bounds);
  if (settings.fadeMs > 0) {
    const fadeFrames = (settings.fadeMs * input.sampleRate) / 1000;
    const trimmedStart = bounds.start > 0;
    const trimmedEnd = bounds.end < frameCount(input.channels);
    channels = fadeEdges(channels, trimmedStart ? fadeFrames : 0, trimmedEnd ? fadeFrames : 0);
  }

  onStage?.('downmix');
  if (!settings.preserveStereo) channels = downmixToMono(channels);

  onStage?.('speedup');
  if (settings.speedMultiplier > 1.0) channels = speedUp(channels, settings.speedMultiplier);

  const targetSampleRate =
    input.container === 'wav' ? resolveWavSampleRate(input.sampleRate, settings.wavSampleRateHz) : undefined;
  let sampleRate = input.sampleRate;
  if (targetSampleRate !== undefined && frameCount(channels) > 0) {
    onStage?.('resample');
    channels = resampleToRate(channels, input.sampleRate, targetSampleRate);
    sampleRate = targetSampleRate;
  }

  // Last, so resampling can't push the normalized peak back over.
  if (settings.normalize) channels = normalizePeak(channels);
  return { channels, sampleRate };
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
    sourceFormat: container === 'wav' ? input.sourceFormat : undefined,
    outputFormat,
  };

  const warning = [bounds.warning, clipNote].filter(Boolean).join(' · ') || undefined;
  return { bytes, outputName, outputExtension: container, stats, warning };
}
