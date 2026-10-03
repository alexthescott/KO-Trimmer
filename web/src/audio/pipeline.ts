import type { ProcessingSettings, ProcessStats } from '../app/types';
import { computeEnergyEnvelope } from './energyEnvelope';
import { detectSilenceRegions } from './silenceDetector';
import { computeTrimBounds, sliceChannels } from './trim';
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
  const energy = computeEnergyEnvelope(input.channels);
  const regions = detectSilenceRegions(
    energy,
    input.sampleRate,
    settings.thresholdDb,
    settings.minDurationMs,
  );
  const bounds = computeTrimBounds(
    input.channels[0]?.length ?? 0,
    regions,
    input.sampleRate,
    settings.paddingMs,
  );
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
