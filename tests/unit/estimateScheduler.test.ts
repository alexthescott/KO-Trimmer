import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EstimateScheduler } from '../../src/app/estimateScheduler';
import type { FileEntry } from '../../src/app/types';
import type { BatchEstimate } from '../../src/app/batchEstimate';
import { DEFAULT_SETTINGS } from '../../src/settings/defaults';

const file = (id: string) => ({ id }) as FileEntry;
const total: BatchEstimate = { originalBytes: 10, estimatedBytes: 5, analysed: 1, total: 1 };

function setup(files: FileEntry[]) {
  const state = { files, settings: DEFAULT_SETTINGS };
  const estimator = {
    estimate: vi.fn(async (_files, _settings, onFile, onProgress) => {
      onFile('a', { bytes: 5, peak: 0.5 });
      onProgress(total);
      return total;
    }),
    forget: vi.fn(),
    cancel: vi.fn(),
  };
  const listener = { onEmpty: vi.fn(), onPending: vi.fn(), onFile: vi.fn(), onTotal: vi.fn() };
  const scheduler = new EstimateScheduler({ current: () => state, listener, estimator, debounceMs: 300 });
  return { state, estimator, listener, scheduler };
}

describe('EstimateScheduler', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('collapses a burst of changes into one estimate once they settle', async () => {
    const { scheduler, estimator, listener } = setup([file('a')]);
    scheduler.schedule();
    await vi.advanceTimersByTimeAsync(200);
    scheduler.schedule();
    await vi.advanceTimersByTimeAsync(200);
    expect(estimator.estimate).not.toHaveBeenCalled();
    expect(listener.onPending).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(100);
    expect(estimator.estimate).toHaveBeenCalledOnce();
    expect(listener.onFile).toHaveBeenCalledWith('a', { bytes: 5, peak: 0.5 });
    expect(listener.onTotal).toHaveBeenLastCalledWith(total);
  });

  it('cancels the estimate in progress whenever it reschedules', () => {
    const { scheduler, estimator } = setup([file('a')]);
    scheduler.schedule();
    scheduler.schedule();
    expect(estimator.cancel).toHaveBeenCalledTimes(2);
  });

  it('reads the latest files when the run starts and forgets removed ones', async () => {
    const { scheduler, estimator, state } = setup([file('a'), file('b')]);
    scheduler.schedule();
    state.files = [file('b')];
    await vi.advanceTimersByTimeAsync(300);
    expect(estimator.forget).toHaveBeenCalledWith(new Set(['b']));
    expect(estimator.estimate.mock.calls[0][0]).toEqual([file('b')]);
  });

  it('reports empty instead of estimating when there are no files', async () => {
    const { scheduler, estimator, listener } = setup([]);
    scheduler.schedule();
    await vi.advanceTimersByTimeAsync(300);
    expect(listener.onEmpty).toHaveBeenCalledOnce();
    expect(estimator.estimate).not.toHaveBeenCalled();
  });

  it('cancel() drops a pending run', async () => {
    const { scheduler, estimator } = setup([file('a')]);
    scheduler.schedule();
    scheduler.cancel();
    await vi.advanceTimersByTimeAsync(300);
    expect(estimator.estimate).not.toHaveBeenCalled();
  });
});
