import type { PipelineOutput, PipelineRequest } from '../audio/pipeline';
import type { ProcessingStage } from '../app/types';

export interface QueuedJob extends PipelineRequest {
  fileId: string;
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
}

export type WorkerOutMessage = ProgressMessage | DoneMessage | ErrorMessage;

/** Typed postMessage from inside a worker (the DOM lib types `self` as Window). */
export function postFromWorker<T>(message: T, transfer: Transferable[] = []): void {
  (self as unknown as Worker).postMessage(message, { transfer });
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
