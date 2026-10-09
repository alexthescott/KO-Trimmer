import type { ProcessingSettings } from '../app/types';
import { computeEnergyEnvelope } from './energyEnvelope';
import { detectSilenceRegions } from './silenceDetector';
import { computeTrimBounds, type TrimBounds } from './trim';
import { frameCount } from './channels';

/** The settings that decide auto-detected trim bounds (and so invalidate cached detections). */
export type DetectionSettings = Pick<ProcessingSettings, 'thresholdDb' | 'minDurationMs' | 'paddingMs'>;

/**
 * Auto-detected trim bounds — the single code path shared by the worker
 * pipeline, the waveform editor's handles, and the batch size estimate.
 */
export function computeAutoTrimBounds(
  channels: Float32Array[],
  sampleRate: number,
  settings: DetectionSettings,
): TrimBounds {
  const energy = computeEnergyEnvelope(channels);
  const regions = detectSilenceRegions(energy, sampleRate, settings.thresholdDb, settings.minDurationMs);
  return computeTrimBounds(frameCount(channels), regions, sampleRate, settings.paddingMs);
}
