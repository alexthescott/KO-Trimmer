import { describe, it, expect, vi } from 'vitest';
import type { FileEntry, ProcessStats } from '../../src/app/types';
import type { JobResult } from '../../src/workers/workerPool';
import { UnsupportedFileError, type QueuedJob } from '../../src/workers/protocol';
import { DEFAULT_SETTINGS } from '../../src/settings/defaults';

vi.mock('../../src/app/decodedCache', () => ({
  decodeEntry: async () => ({ channels: [new Float32Array(4)], sampleRate: 44100 }),
}));

const { processBatch } = await import('../../src/app/processBatch');

function entry(relativePath: string, extra: Partial<FileEntry> = {}): FileEntry {
  const name = relativePath.split('/').pop()!;
  return {
    id: relativePath,
    name,
    relativePath,
    size: 1000,
    file: new File([new Uint8Array(8)], name),
    status: 'queued',
    ...extra,
  };
}

function result(fileId: string, stats: Partial<ProcessStats> = {}): JobResult {
  return {
    fileId,
    aborted: false,
    bytes: new Uint8Array(100),
    outputName: `${fileId
      .split('/')
      .pop()!
      .replace(/\.\w+$/, '')}_trimmed.wav`,
    outputExtension: 'wav',
    stats: {
      originalBytes: 1000,
      outputBytes: 100,
      originalDurationSec: 1,
      outputDurationSec: 0.5,
      exceedsKoIILength: false,
      keptFloatToAvoidClipping: false,
      ...stats,
    },
  };
}

/** Pool whose jobs are answered by `respond`; records every job it was given. */
function fakePool(respond: (job: QueuedJob) => Promise<JobResult>) {
  const jobs: QueuedJob[] = [];
  const pool = {
    size: 2,
    enqueue: (job: QueuedJob) => {
      jobs.push(job);
      return respond(job);
    },
    abort: vi.fn(),
    terminate: vi.fn(),
  };
  return { pool, jobs };
}

function fakeSink() {
  const written: string[] = [];
  return { written, write: async (path: string) => void written.push(path), finalize: vi.fn(async () => {}) };
}

async function run(
  files: FileEntry[],
  respond: (job: QueuedJob) => Promise<JobResult>,
  signal = new AbortController().signal,
) {
  const { pool, jobs } = fakePool(respond);
  const sink = fakeSink();
  const updates = new Map<string, Partial<FileEntry>>();
  const summary = await processBatch({
    files,
    settings: DEFAULT_SETTINGS,
    outputSink: sink,
    signal,
    onFileUpdate: (id, patch) => updates.set(id, { ...updates.get(id), ...patch }),
    createPool: () => pool,
  });
  return { summary, pool, jobs, sink, updates };
}

describe('processBatch', () => {
  it('writes each output under its path minus the root folder and tallies the batch', async () => {
    const files = [entry('kit/kick.wav'), entry('kit/snares/snare.wav'), entry('loose.wav')];
    const { summary, sink, updates, pool } = await run(files, async (job) => result(job.fileId));

    expect(sink.written.sort()).toEqual(['kick_trimmed.wav', 'loose_trimmed.wav', 'snares/snare_trimmed.wav']);
    expect(summary).toMatchObject({
      processedCount: 3,
      errorCount: 0,
      originalBytes: 3000,
      outputBytes: 300,
      aborted: false,
    });
    expect(updates.get('kit/kick.wav')).toMatchObject({ status: 'done', outputName: 'kick_trimmed.wav' });
    expect(sink.finalize).toHaveBeenCalledOnce();
    expect(pool.terminate).toHaveBeenCalledOnce();
  });

  it('sends WAV and AIFF to the worker as a file and other formats as main-thread PCM', async () => {
    const { jobs } = await run([entry('a.wav'), entry('b.flac'), entry('c.aif')], async (job) => result(job.fileId));
    expect(Object.fromEntries(jobs.map((j) => [j.fileId, j.source.kind]))).toEqual({
      'a.wav': 'file',
      'b.flac': 'pcm',
      'c.aif': 'file',
    });
  });

  it('retries a WAV the worker cannot decode with main-thread PCM', async () => {
    const { jobs, summary } = await run([entry('adpcm.wav')], async (job) => {
      if (job.source.kind === 'file') throw new UnsupportedFileError();
      return result(job.fileId);
    });
    expect(jobs.map((j) => j.source.kind)).toEqual(['file', 'pcm']);
    expect(summary.processedCount).toBe(1);
  });

  it('isolates a failing file as an error and keeps going', async () => {
    const { summary, updates } = await run([entry('bad.wav'), entry('good.wav')], async (job) => {
      if (job.fileId === 'bad.wav') throw new Error('corrupt header');
      return result(job.fileId);
    });
    expect(summary).toMatchObject({ processedCount: 1, errorCount: 1 });
    expect(updates.get('bad.wav')).toMatchObject({ status: 'error', error: 'corrupt header' });
  });

  it('counts KO II overruns, kept-float files, and format conversions', async () => {
    const pcm16 = { bits: 16, float: false };
    const float32 = { bits: 32, float: true };
    const { summary } = await run([entry('long.wav'), entry('loud.wav')], async (job) =>
      job.fileId === 'long.wav'
        ? result(job.fileId, { exceedsKoIILength: true, sourceFormat: float32, outputFormat: pcm16 })
        : result(job.fileId, { keptFloatToAvoidClipping: true, sourceFormat: float32, outputFormat: float32 }),
    );
    expect(summary.overKoIILengthNames).toEqual(['long_trimmed.wav']);
    expect(summary.keptFloatCount).toBe(1);
    expect(summary.formatConversions).toEqual({ '32-bit float → 16-bit': 1 });
  });

  it('skips every file and reports aborted when stopped', async () => {
    const controller = new AbortController();
    controller.abort();
    const { summary, jobs, updates } = await run(
      [entry('a.wav'), entry('b.wav')],
      async (job) => result(job.fileId),
      controller.signal,
    );
    expect(jobs).toHaveLength(0);
    expect(summary).toMatchObject({ processedCount: 0, skippedCount: 2, aborted: true });
    expect(updates.get('a.wav')?.status).toBe('skipped');
  });

  it('marks jobs that finish after Stop as skipped, not done', async () => {
    const controller = new AbortController();
    const { summary, pool } = await run(
      [entry('a.wav')],
      async (job) => {
        controller.abort();
        return { ...result(job.fileId), aborted: true };
      },
      controller.signal,
    );
    expect(pool.abort).toHaveBeenCalled();
    expect(summary).toMatchObject({ processedCount: 0, skippedCount: 1, aborted: true });
  });
});
