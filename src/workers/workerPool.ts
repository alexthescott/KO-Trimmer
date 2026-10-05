import type { ProcessingSettings, ProcessingStage, ProcessStats } from '../app/types';
import type { WorkerOutMessage } from './protocol';
import type { SampleFormat } from '../audio/sampleFormat';

export interface QueuedJob {
  fileId: string;
  channels: Float32Array[];
  sampleRate: number;
  extension: string;
  baseName: string;
  settings: ProcessingSettings;
  originalBytes: number;
  sourceFormat?: SampleFormat;
  manualTrim?: { start: number; end: number };
}

export interface JobResult {
  fileId: string;
  bytes: Uint8Array;
  outputName: string;
  outputExtension: string;
  stats: ProcessStats;
  warning?: string;
  aborted: boolean;
}

export type ProgressHandler = (fileId: string, stage: ProcessingStage) => void;

interface PendingEntry {
  job: QueuedJob;
  resolve: (result: JobResult) => void;
  reject: (err: Error) => void;
}

function defaultPoolSize(): number {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 4;
  return Math.min(4, Math.max(1, (cores || 4) - 1));
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

  constructor(onProgress: ProgressHandler = () => {}, size = defaultPoolSize()) {
    this.onProgress = onProgress;
    this.workers = Array.from({ length: size }, () => this.createWorker());
    this.freeWorkers = [...this.workers];
  }

  private createWorker(): Worker {
    const worker = new Worker(new URL('./processing.worker.ts', import.meta.url), {
      type: 'module',
    });
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
      entry.reject(new Error(msg.message));
      return;
    }

    entry.resolve({
      fileId: msg.fileId,
      bytes: msg.bytes,
      outputName: msg.outputName,
      outputExtension: msg.outputExtension,
      stats: msg.stats,
      warning: msg.warning,
      aborted: this.aborted,
    });
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

    worker.postMessage(
      {
        type: 'process',
        jobId,
        fileId: entry.job.fileId,
        channels: entry.job.channels,
        sampleRate: entry.job.sampleRate,
        extension: entry.job.extension,
        baseName: entry.job.baseName,
        settings: entry.job.settings,
        originalBytes: entry.job.originalBytes,
        sourceFormat: entry.job.sourceFormat,
        manualTrim: entry.job.manualTrim,
      },
      { transfer: entry.job.channels.map((c) => c.buffer) },
    );
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
    for (const jobId of this.pendingByJobId.keys()) {
      for (const [worker, id] of this.jobIdByWorker) {
        if (id === jobId) worker.postMessage({ type: 'cancel', jobId });
      }
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
