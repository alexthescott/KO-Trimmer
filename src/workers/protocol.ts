import type { PipelineOutput, PipelineRequest } from '../audio/pipeline';
import type { ProcessingStage } from '../app/types';
import type { PcmAudio } from '../audio/channels';

/**
 * Where the job's audio comes from: PCM already decoded on the main thread,
 * or a WAV file the worker reads and decodes itself (no main-thread work).
 */
export type JobSource =
  | ({ kind: 'pcm' } & PcmAudio)
  | { kind: 'wav'; file: File };

export interface QueuedJob extends Omit<PipelineRequest, 'channels' | 'sampleRate'> {
  fileId: string;
  source: JobSource;
}

export interface ProcessJobRequest extends QueuedJob {
  type: 'process';
  jobId: string;
}

export interface CancelJobRequest {
  type: 'cancel';
  jobId: string;
}

export type WorkerInMessage = ProcessJobRequest | CancelJobRequest;

export interface ProgressMessage {
  type: 'progress';
  jobId: string;
  fileId: string;
  stage: ProcessingStage;
}

export interface DoneMessage extends PipelineOutput {
  type: 'done';
  jobId: string;
  fileId: string;
}

export interface ErrorMessage {
  type: 'error';
  jobId: string;
  fileId: string;
  message: string;
  /** A `wav` source the worker's decoder can't read (e.g. ADPCM); decode it on the main thread instead. */
  unsupportedWav?: boolean;
}

export type WorkerOutMessage = ProgressMessage | DoneMessage | ErrorMessage;

/** Typed postMessage from inside a worker (the DOM lib types `self` as Window). */
export function postFromWorker<T>(message: T, transfer: Transferable[] = []): void {
  (self as unknown as Worker).postMessage(message, { transfer });
}

/** Rejection for an `unsupportedWav` worker error, so the caller can retry with a `pcm` source. */
export class UnsupportedWavError extends Error {
  constructor() {
    super('WAV encoding not supported by the worker decoder');
    this.name = 'UnsupportedWavError';
  }
}
