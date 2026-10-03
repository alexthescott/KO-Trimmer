export type BitrateKbps = 320 | 192 | 160 | 128 | 96 | 64;

export interface ProcessingSettings {
  thresholdDb: number;
  minDurationMs: number;
  paddingMs: number;
  preserveStereo: boolean;
  bitrateKbps: BitrateKbps;
  speedMultiplier: number;
  overwrite: boolean;
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
  longerThan20s: boolean;
}

export interface FileEntry {
  id: string;
  name: string;
  relativePath: string;
  size: number;
  sourceKind: 'handle' | 'file';
  fileHandle?: FileSystemFileHandle;
  file?: File;
  status: FileStatus;
  error?: string;
  warning?: string;
  resultBlob?: Blob;
  resultBlobUrl?: string;
  outputName?: string;
  stats?: ProcessStats;
  stage?: ProcessingStage;
  /** Manually dragged trim points in source samples (end exclusive); overrides auto-detect. */
  manualTrim?: { start: number; end: number };
}

export interface FavoriteDirectory {
  id: string;
  displayName: string;
  handle: FileSystemDirectoryHandle;
}
