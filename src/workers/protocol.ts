import type { ProcessingSettings, ProcessingStage, ProcessStats } from '../app/types';

export interface ProcessJobRequest {
  type: 'process';
  jobId: string;
  fileId: string;
  channels: Float32Array[];
  sampleRate: number;
  extension: string;
  baseName: string;
  settings: ProcessingSettings;
  originalBytes: number;
  manualTrim?: { start: number; end: number };
}

export type WorkerInMessage = ProcessJobRequest;

export interface ProgressMessage {
  type: 'progress';
  jobId: string;
  fileId: string;
  stage: ProcessingStage;
}

export interface DoneMessage {
  type: 'done';
  jobId: string;
  fileId: string;
  bytes: Uint8Array;
  outputName: string;
  outputExtension: string;
  stats: ProcessStats;
  warning?: string;
}

export interface ErrorMessage {
  type: 'error';
  jobId: string;
  fileId: string;
  message: string;
}

export type WorkerOutMessage = ProgressMessage | DoneMessage | ErrorMessage;
