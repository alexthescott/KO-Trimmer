import type { FileEntry, ProcessingSettings } from './types';
import { BatchEstimator, type BatchEstimate, type FileEstimate } from './batchEstimate';

const DEFAULT_DEBOUNCE_MS = 300;

export interface EstimateListener {
  /** No files: nothing to estimate. */
  onEmpty(): void;
  /** An estimate is scheduled or running. */
  onPending(): void;
  onFile(id: string, estimate: FileEstimate): void;
  /** Running total, then the final one. */
  onTotal(estimate: BatchEstimate): void;
}

export interface EstimateSchedulerOptions {
  /** Read when the debounced run starts, so it always sees the latest files and settings. */
  current: () => { files: FileEntry[]; settings: ProcessingSettings };
  listener: EstimateListener;
  estimator?: Pick<BatchEstimator, 'estimate' | 'forget' | 'cancel'>;
  debounceMs?: number;
}

/**
 * Debounces whole-batch size estimates: every file or settings change
 * restarts the countdown and cancels any run in progress, so a slider drag
 * produces one estimate once it settles rather than one per tick.
 */
export class EstimateScheduler {
  private timer?: ReturnType<typeof setTimeout>;
  private readonly estimator: Pick<BatchEstimator, 'estimate' | 'forget' | 'cancel'>;
  private readonly debounceMs: number;

  constructor(private readonly options: EstimateSchedulerOptions) {
    this.estimator = options.estimator ?? new BatchEstimator();
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  }

  schedule(): void {
    this.cancel();
    if (this.options.current().files.length === 0) {
      this.options.listener.onEmpty();
      return;
    }
    this.options.listener.onPending();
    this.timer = setTimeout(() => void this.run(), this.debounceMs);
  }

  cancel(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.estimator.cancel();
  }

  private async run(): Promise<void> {
    const { files, settings } = this.options.current();
    const { listener } = this.options;
    this.estimator.forget(new Set(files.map((f) => f.id)));
    const result = await this.estimator.estimate(
      files,
      settings,
      (id, estimate) => listener.onFile(id, estimate),
      (progress) => listener.onTotal(progress),
    );
    if (result) listener.onTotal(result);
  }
}
