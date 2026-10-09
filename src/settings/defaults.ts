import type { ProcessingSettings } from '../app/types';

export const DEFAULT_SETTINGS: ProcessingSettings = {
  thresholdDb: -50,
  minDurationMs: 10,
  paddingMs: 20,
  preserveStereo: true,
  preserveBitDepth: false,
  bitrateKbps: 320,
  wavSampleRateHz: null,
  speedSemitones: 0,
  fadeMs: 0,
  normalize: false,
  overwrite: false,
};

/** Bounds and step of each numeric setting's control. */
export const SETTINGS_RANGES = {
  thresholdDb: { min: -60, max: 0, step: 1 },
  minDurationMs: { min: 10, max: 10000, step: 10 },
  paddingMs: { min: 0, max: 1000, step: 10 },
  // Two octaves: +24 semitones = 4x.
  speedSemitones: { min: 0, max: 24, step: 1 },
  fadeMs: { min: 0, max: 50, step: 1 },
} as const;
