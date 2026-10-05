import type { ProcessingSettings } from '../app/types';

export const DEFAULT_SETTINGS: ProcessingSettings = {
  thresholdDb: -50,
  minDurationMs: 10,
  paddingMs: 20,
  preserveStereo: true,
  preserveBitDepth: false,
  bitrateKbps: 320,
  wavSampleRateHz: null,
  speedMultiplier: 1.0,
  overwrite: false,
};

/** Bounds and step of each numeric setting's control. */
export const SETTINGS_RANGES = {
  thresholdDb: { min: -60, max: 0, step: 1 },
  minDurationMs: { min: 10, max: 10000, step: 10 },
  paddingMs: { min: 0, max: 1000, step: 10 },
  speedMultiplier: { min: 1.0, max: 3.0, step: 0.05 },
} as const;
