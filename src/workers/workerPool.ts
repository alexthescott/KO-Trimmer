import type { ProcessingStage } from '../app/types';
import type { PipelineOutput } from '../audio/pipeline';
import {
  UnsupportedWavError,
  type CancelJobRequest,
  type ProcessJobRequest,
  type QueuedJob,
  type WorkerOutMessage,
} from './protocol';

export type { QueuedJob } from './protocol';

export interface JobResult extends PipelineOutput {
  fileId: string;
  aborted: boolean;
}

export type ProgressHandler = (fileId: string, stage: ProcessingStage) => void;

interface PendingEntry {
  job: QueuedJob;
  resolve: (result: JobResult) => void;
  reject: (err: Error) => void;
}

/**
 * One worker per core, leaving one for the main thread. Capped because each
 * busy worker holds a whole file's PCM plus pipeline intermediates.
 */
const MAX_WORKERS = 8;

function defaultPoolSize(): number {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 4;
  return Math.min(MAX_WORKERS, Math.max(1, (cores || 4) - 1));
}

function createProcessingWorker(): Worker {
  return new Worker(new URL('./processing.worker.ts', import.meta.url), { type: 'module' });
}

export interface WorkerPoolOptions {
  size?: number;
  /** Builds one worker; a fake in tests. */
  createWorker?: () => Worker;
}

/**
 * Pooled Web Worker batch processor. Queued-but-undispatched jobs are
 * dropped immediately on abort; jobs already running are allowed to finish
 * (a cancel signal is also forwarded so the MP3 encode loop's own
 * checkpoint can bail early) and are reported back with `aborted: true`
 * so the caller can mark that row "skipped" rather than "done".
 */
export class WorkerPool {
  private workers: Worker[];
  private freeWorkers: Worker[];
  private jobIdByWorker = new Map<Worker, string>();
  private pendingByJobId = new Map<string, PendingEntry>();
  private queue: PendingEntry[] = [];
  private aborted = false;
  private onProgress: ProgressHandler;

  get size(): number {
    return this.workers.length;
  }

  constructor(onProgress: ProgressHandler = () => {}, options: WorkerPoolOptions = {}) {
    const { size = defaultPoolSize(), createWorker = createProcessingWorker } = options;
    this.onProgress = onProgress;
    this.workers = Array.from({ length: size }, () => this.attach(createWorker()));
    this.freeWorkers = [...this.workers];
  }

  private attach(worker: Worker): Worker {
    worker.onmessage = (event: MessageEvent<WorkerOutMessage>) =>
      this.handleMessage(worker, event.data);
    worker.onerror = (event) => {
      const jobId = this.jobIdByWorker.get(worker);
      if (!jobId) return;
      const entry = this.pendingByJobId.get(jobId);
      this.cleanupWorker(worker, jobId);
      entry?.reject(new Error(event.message || 'Worker error'));
    };
    return worker;
  }

  private cleanupWorker(worker: Worker, jobId: string): void {
    this.pendingByJobId.delete(jobId);
    this.jobIdByWorker.delete(worker);
    this.freeWorkers.push(worker);
    this.dispatchNext();
  }

  private handleMessage(worker: Worker, msg: WorkerOutMessage): void {
    if (msg.type === 'progress') {
      this.onProgress(msg.fileId, msg.stage);
      return;
    }

    const entry = this.pendingByJobId.get(msg.jobId);
    this.cleanupWorker(worker, msg.jobId);
    if (!entry) return;

    if (msg.type === 'error') {
      entry.reject(msg.unsupportedWav ? new UnsupportedWavError() : new Error(msg.message));
      return;
    }

    const { type: _type, jobId: _jobId, ...output } = msg;
    entry.resolve({ ...output, aborted: this.aborted });
  }

  private dispatchNext(): void {
    if (this.aborted) {
      // Drop everything still queued; in-flight jobs are left to finish.
      for (const entry of this.queue) {
        entry.reject(abortError());
      }
      this.queue = [];
      return;
    }

    const worker = this.freeWorkers.pop();
    if (!worker) return;
    const entry = this.queue.shift();
    if (!entry) {
      this.freeWorkers.push(worker);
      return;
    }

    const jobId = crypto.randomUUID();
    this.jobIdByWorker.set(worker, jobId);
    this.pendingByJobId.set(jobId, entry);

    worker.postMessage({ type: 'process', jobId, ...entry.job } satisfies ProcessJobRequest, {
      transfer: entry.job.source.kind === 'pcm' ? entry.job.source.channels.map((c) => c.buffer) : [],
    });
  }

  enqueue(job: QueuedJob): Promise<JobResult> {
    return new Promise((resolve, reject) => {
      if (this.aborted) {
        reject(abortError());
        return;
      }
      this.queue.push({ job, resolve, reject });
      this.dispatchNext();
    });
  }

  /** Drops queued jobs and forwards a best-effort cancel to in-flight workers. */
  abort(): void {
    this.aborted = true;
    for (const [worker, jobId] of this.jobIdByWorker) {
      worker.postMessage({ type: 'cancel', jobId } satisfies CancelJobRequest);
    }
    this.dispatchNext();
  }

  terminate(): void {
    this.workers.forEach((w) => w.terminate());
  }
}

function abortError(): Error {
  return new DOMException('Aborted', 'AbortError');
}
