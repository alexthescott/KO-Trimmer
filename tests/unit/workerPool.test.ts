import { describe, it, expect, vi } from 'vitest';
import { WorkerPool } from '../../src/workers/workerPool';
import {
  UnsupportedFileError,
  type QueuedJob,
  type WorkerInMessage,
  type WorkerOutMessage,
} from '../../src/workers/protocol';
import { DEFAULT_SETTINGS } from '../../src/settings/defaults';

/** Stand-in Worker: records what it's sent; the test plays the worker's replies. */
class FakeWorker {
  onmessage: ((event: { data: WorkerOutMessage }) => void) | null = null;
  onerror: ((event: { message: string }) => void) | null = null;
  sent: Array<{ message: WorkerInMessage; transfer: Transferable[] }> = [];
  terminate = vi.fn();

  postMessage(message: WorkerInMessage, options: { transfer?: Transferable[] } = {}): void {
    this.sent.push({ message, transfer: options.transfer ?? [] });
  }

  /** The job this worker is currently running (its last 'process' message). */
  get job() {
    const process = this.sent.filter((s) => s.message.type === 'process').at(-1)?.message;
    if (process?.type !== 'process') throw new Error('worker has no job');
    return process;
  }

  finish(): void {
    const { jobId, fileId } = this.job;
    this.onmessage?.({
      data: {
        type: 'done',
        jobId,
        fileId,
        bytes: new Uint8Array(1),
        outputName: `${fileId}.wav`,
        outputExtension: 'wav',
        stats: {
          originalBytes: 10,
          outputBytes: 1,
          originalDurationSec: 1,
          outputDurationSec: 1,
          exceedsKoIILength: false,
          keptFloatToAvoidClipping: false,
        },
      },
    });
  }

  fail(extra: { unsupportedFile?: boolean } = {}): void {
    const { jobId, fileId } = this.job;
    this.onmessage?.({ data: { type: 'error', jobId, fileId, message: 'bad data', ...extra } });
  }
}

function makePool(size: number) {
  const workers: FakeWorker[] = [];
  const onProgress = vi.fn();
  const pool = new WorkerPool(onProgress, {
    size,
    createWorker: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker as unknown as Worker;
    },
  });
  return { pool, workers, onProgress };
}

function job(
  fileId: string,
  source: QueuedJob['source'] = { kind: 'file', file: new File([], `${fileId}.wav`) },
): QueuedJob {
  return { fileId, source, extension: 'wav', baseName: fileId, settings: DEFAULT_SETTINGS, originalBytes: 10 };
}

const busy = (workers: FakeWorker[]) => workers.filter((w) => w.sent.some((s) => s.message.type === 'process'));

describe('WorkerPool', () => {
  it('runs up to `size` jobs at once and starts queued ones as workers free up', async () => {
    const { pool, workers } = makePool(2);
    const results = ['a', 'b', 'c'].map((id) => pool.enqueue(job(id)));
    expect(busy(workers).map((w) => w.job.fileId)).toEqual(['b', 'a']);

    workers[1].finish(); // 'a' done -> 'c' takes its worker
    expect(workers[1].job.fileId).toBe('c');
    workers[0].finish();
    workers[1].finish();

    const done = await Promise.all(results);
    expect(done.map((r) => [r.fileId, r.aborted])).toEqual([
      ['a', false],
      ['b', false],
      ['c', false],
    ]);
  });

  it('forwards progress messages', () => {
    const { pool, workers, onProgress } = makePool(1);
    void pool.enqueue(job('a'));
    const { jobId } = workers[0].job;
    workers[0].onmessage?.({ data: { type: 'progress', jobId, fileId: 'a', stage: 'trim' } });
    expect(onProgress).toHaveBeenCalledWith('a', 'trim');
  });

  it('transfers PCM buffers to the worker but not a WAV file', () => {
    const { pool, workers } = makePool(2);
    const channel = new Float32Array(4);
    void pool.enqueue(job('pcm', { kind: 'pcm', channels: [channel], sampleRate: 8000 }));
    void pool.enqueue(job('wav'));
    const byFile = Object.fromEntries(workers.map((w) => [w.job.fileId, w.sent[0].transfer]));
    expect(byFile.pcm).toEqual([channel.buffer]);
    expect(byFile.wav).toEqual([]);
  });

  it('maps worker errors, flagging WAV the worker cannot decode', async () => {
    const { pool, workers } = makePool(2);
    const unsupported = pool.enqueue(job('adpcm'));
    const broken = pool.enqueue(job('broken'));
    workers.find((w) => w.job.fileId === 'adpcm')!.fail({ unsupportedFile: true });
    workers.find((w) => w.job.fileId === 'broken')!.fail();
    await expect(unsupported).rejects.toBeInstanceOf(UnsupportedFileError);
    await expect(broken).rejects.toThrow('bad data');
  });

  it('rejects the running job on a worker crash and keeps using the worker', async () => {
    const { pool, workers } = makePool(1);
    const crashed = pool.enqueue(job('a'));
    const next = pool.enqueue(job('b'));
    workers[0].onerror?.({ message: 'out of memory' });
    await expect(crashed).rejects.toThrow('out of memory');
    expect(workers[0].job.fileId).toBe('b');
    workers[0].finish();
    await expect(next).resolves.toMatchObject({ fileId: 'b' });
  });

  it('on abort: drops queued jobs, cancels running ones, and marks their results aborted', async () => {
    const { pool, workers } = makePool(1);
    const running = pool.enqueue(job('a'));
    const queued = pool.enqueue(job('b'));
    pool.abort();

    await expect(queued).rejects.toMatchObject({ name: 'AbortError' });
    expect(workers[0].sent.at(-1)?.message).toEqual({ type: 'cancel', jobId: workers[0].job.jobId });
    workers[0].finish();
    await expect(running).resolves.toMatchObject({ fileId: 'a', aborted: true });
    await expect(pool.enqueue(job('c'))).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('terminates every worker', () => {
    const { pool, workers } = makePool(3);
    pool.terminate();
    expect(workers.every((w) => w.terminate.mock.calls.length === 1)).toBe(true);
  });
});
