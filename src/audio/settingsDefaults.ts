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

export const SETTINGS_RANGES = {
  thresholdDb: { min: -60, max: 0, step: 1 },
  minDurationMs: { min: 10, max: 10000, step: 10 },
  paddingMs: { min: 0, max: 1000, step: 10 },
  speedMultiplier: { min: 1.0, max: 3.0, step: 0.05 },
} as const;

export const BITRATE_OPTIONS = [320, 192, 160, 128, 96, 64] as const;

/** Top MP3 bitrate: no suffix in the filename and no lossy round-trip in the preview. */
export const FULL_MP3_BITRATE = BITRATE_OPTIONS[0];

export const WAV_SAMPLE_RATE_OPTIONS = [44100, 22050, 16000, 11025, 8000] as const;

export const SUPPORTED_EXTENSIONS = ['wav', 'mp3', 'flac', 'aiff', 'm4a', 'ogg'] as const;
