import type { FileEntry, ProcessingSettings } from './types';
import { splitNameAndExtension } from './fileNames';
import { decodeEntry } from './decodedCache';
import { WorkerPool, type JobResult, type ProgressHandler } from '../workers/workerPool';
import type { OutputSink } from '../fs/outputWriter';
import { overwriteSourceFile, canOverwrite } from '../fs/overwriteWriter';
import { formatLabel, sameFormat } from '../audio/sampleFormat';
import { UnsupportedFileError, type JobSource, type QueuedJob } from '../workers/protocol';
import { errorMessage } from './errors';
import { PCM_FILE_EXTENSIONS } from '../audio/pcmFileDecoder';
import { forEachConcurrent } from './concurrency';

/**
 * Files decoded ahead of a free worker. Each in-flight file holds its source
 * bytes and decoded float32 PCM (2-10x the file size), so starting the whole
 * batch at once would exhaust memory on large folders.
 */
const DECODE_AHEAD = 2;

export interface BatchSummary {
  processedCount: number;
  skippedCount: number;
  errorCount: number;
  originalBytes: number;
  outputBytes: number;
  /** Outputs still over the KO II length limit after processing. */
  overKoIILengthNames: string[];
  /** Written as 32-bit float because 16/24-bit output would have clipped. */
  keptFloatCount: number;
  /** e.g. { "32-bit float → 16-bit": 14 } */
  formatConversions: Record<string, number>;
  aborted: boolean;
}

/** What processBatch needs from a worker pool; WorkerPool in the app, a fake in tests. */
export type JobRunner = Pick<WorkerPool, 'size' | 'enqueue' | 'abort' | 'terminate'>;

export interface BatchRequest {
  files: FileEntry[];
  settings: ProcessingSettings;
  outputSink: OutputSink;
  signal: AbortSignal;
  /** Per-file status/stage/result patches, as they happen. */
  onFileUpdate: (id: string, patch: Partial<FileEntry>) => void;
  createPool?: (onProgress: ProgressHandler) => JobRunner;
}

/** One batch run's shared collaborators, so per-file helpers take two arguments, not five. */
interface BatchRun {
  settings: ProcessingSettings;
  outputSink: OutputSink;
  signal: AbortSignal;
  pool: JobRunner;
}

type FileOutcome = { kind: 'done'; result: JobResult } | { kind: 'skipped' } | { kind: 'error'; message: string };

const NOT_OVERWRITTEN_WARNING = 'Not overwritten — re-encoded as WAV, written as a new file';

export async function processBatch(request: BatchRequest): Promise<BatchSummary> {
  const { files, settings, outputSink, signal, onFileUpdate } = request;
  const createPool = request.createPool ?? ((onProgress) => new WorkerPool(onProgress));
  const pool = createPool((fileId, stage) => onFileUpdate(fileId, { stage }));
  const run: BatchRun = { settings, outputSink, signal, pool };
  const summary = emptySummary();
  const onAbort = () => pool.abort();
  signal.addEventListener('abort', onAbort);

  await forEachConcurrent(files, pool.size + DECODE_AHEAD, async (file) => {
    onFileUpdate(file.id, { status: 'processing' });
    const outcome = await processFile(file, run);
    onFileUpdate(file.id, outcomePatch(outcome));
    tally(summary, outcome);
  });
  signal.removeEventListener('abort', onAbort);
  pool.terminate();
  await outputSink.finalize();

  summary.aborted = signal.aborted;
  return summary;
}

/**
 * Decode -> pipeline (worker) -> write. WAV and AIFF are decoded in the
 * worker; other formats (and WAV/AIFF the worker can't read) via
 * decodeAudioData on the main thread. Never throws: failures become an outcome.
 */
async function processFile(file: FileEntry, run: BatchRun): Promise<FileOutcome> {
  if (run.signal.aborted) return { kind: 'skipped' };
  try {
    const result = await runJob(file, run);
    if (result.aborted) return { kind: 'skipped' };
    return { kind: 'done', result: await writeOutput(file, result, run) };
  } catch (err) {
    return run.signal.aborted ? { kind: 'skipped' } : { kind: 'error', message: errorMessage(err) };
  }
}

/** Runs the pipeline job, retrying with main-thread PCM when the worker can't decode the file itself. */
async function runJob(file: FileEntry, { settings, pool }: BatchRun): Promise<JobResult> {
  const job: Omit<QueuedJob, 'source'> = {
    fileId: file.id,
    ...splitNameAndExtension(file.name),
    settings,
    originalBytes: file.size,
    sourceFormat: file.sourceFormat,
    manualTrim: file.manualTrim,
  };
  const source: JobSource = PCM_FILE_EXTENSIONS.has(job.extension)
    ? { kind: 'file', file: file.file }
    : await decodeOnMainThread(file);
  try {
    return await pool.enqueue({ ...job, source });
  } catch (err) {
    if (!(err instanceof UnsupportedFileError)) throw err;
    return pool.enqueue({ ...job, source: await decodeOnMainThread(file) });
  }
}

async function decodeOnMainThread(file: FileEntry): Promise<JobSource> {
  return { kind: 'pcm', ...(await decodeEntry(file)) };
}

/** Overwrites the source when enabled and possible, else writes to the sink; returns the result with any added warning. */
async function writeOutput(file: FileEntry, result: JobResult, { settings, outputSink }: BatchRun): Promise<JobResult> {
  if (settings.overwrite && canOverwrite(file)) {
    await overwriteSourceFile(file.fileHandle, result.bytes);
    return result;
  }
  await outputSink.write(deriveOutputRelativePath(file, result.outputName), result.bytes);
  if (!settings.overwrite) return result;
  return { ...result, warning: [result.warning, NOT_OVERWRITTEN_WARNING].filter(Boolean).join(' · ') };
}

/** Strips the top-level root folder segment, keeping any deeper subfolder structure. */
function deriveOutputRelativePath(file: FileEntry, outputName: string): string {
  const parts = file.relativePath.split('/');
  if (parts.length <= 1) return outputName;
  return [...parts.slice(1, -1), outputName].join('/');
}

function outcomePatch(outcome: FileOutcome): Partial<FileEntry> {
  switch (outcome.kind) {
    case 'done': {
      const { outputName, stats, warning } = outcome.result;
      return { status: 'done', outputName, stats, warning, stage: undefined };
    }
    case 'skipped':
      return { status: 'skipped' };
    case 'error':
      return { status: 'error', error: outcome.message };
  }
}

function tally(summary: BatchSummary, outcome: FileOutcome): void {
  if (outcome.kind === 'skipped') {
    summary.skippedCount++;
    return;
  }
  if (outcome.kind === 'error') {
    summary.errorCount++;
    return;
  }
  const { stats, outputName } = outcome.result;
  summary.processedCount++;
  summary.originalBytes += stats.originalBytes;
  summary.outputBytes += stats.outputBytes;
  if (stats.exceedsKoIILength) summary.overKoIILengthNames.push(outputName);
  if (stats.keptFloatToAvoidClipping) summary.keptFloatCount++;
  const { sourceFormat, outputFormat } = stats;
  if (sourceFormat && outputFormat && !sameFormat(sourceFormat, outputFormat)) {
    const key = `${formatLabel(sourceFormat)} → ${formatLabel(outputFormat)}`;
    summary.formatConversions[key] = (summary.formatConversions[key] ?? 0) + 1;
  }
}

function emptySummary(): BatchSummary {
  return {
    processedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    originalBytes: 0,
    outputBytes: 0,
    overKoIILengthNames: [],
    keptFloatCount: 0,
    formatConversions: {},
    aborted: false,
  };
}
