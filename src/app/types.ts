import type { SampleFormat } from '../audio/sampleFormat';

export type BitrateKbps = 320 | 192 | 160 | 128 | 96 | 64;

export interface ProcessingSettings {
  thresholdDb: number;
  minDurationMs: number;
  paddingMs: number;
  preserveStereo: boolean;
  /** Keep the source's bit depth (e.g. 32-bit float) instead of writing 16-bit WAV. */
  preserveBitDepth: boolean;
  /** MP3 output only. */
  bitrateKbps: BitrateKbps;
  /** WAV output only: max sample rate (only ever lowers it); null = keep original. */
  wavSampleRateHz: number | null;
  speedMultiplier: number;
  overwrite: boolean;
}

/** Sample positions, end exclusive. */
export interface SampleRange {
  start: number;
  end: number;
}

export interface SilenceRegion {
  start: number;
  end: number;
  duration: number;
}

export type FileStatus = 'queued' | 'processing' | 'done' | 'error' | 'skipped';

export type ProcessingStage = 'decode' | 'trim' | 'downmix' | 'speedup' | 'resample' | 'encode';

export interface ProcessStats {
  originalBytes: number;
  outputBytes: number;
  originalDurationSec: number;
  outputDurationSec: number;
  exceedsKoIILength: boolean;
  /** Integer output would have clipped, so 32-bit float was written instead. */
  keptFloatToAvoidClipping: boolean;
  /** Set for WAV output when the source bit depth is known. */
  sourceFormat?: SampleFormat;
  outputFormat?: SampleFormat;
}

export interface FileEntry {
  id: string;
  name: string;
  relativePath: string;
  size: number;
  fileHandle?: FileSystemFileHandle;
  file: File;
  status: FileStatus;
  error?: string;
  warning?: string;
  outputName?: string;
  stats?: ProcessStats;
  stage?: ProcessingStage;
  /** Bit depth read from the file header; undefined for lossy/unknown formats. */
  sourceFormat?: SampleFormat;
  /** Native sample rate from the header; decode runs at this rate instead of the device's. */
  sourceSampleRate?: number;
  /** Manually dragged trim points in source samples (end exclusive); overrides auto-detect. */
  manualTrim?: SampleRange;
}
