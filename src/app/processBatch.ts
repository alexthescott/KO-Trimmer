import type { FileEntry, ProcessingSettings } from './types';
import { appState } from './state';
import { splitNameAndExtension } from './fileNames';
import { decodeAudioFile } from '../audio/decode';
import { WorkerPool, type JobResult } from '../workers/workerPool';
import type { OutputSink } from '../fs/outputWriter';
import { overwriteSourceFile, canOverwrite } from '../fs/overwriteWriter';
import { formatLabel, sameFormat } from '../audio/sampleFormat';
import { errorMessage } from '../workers/protocol';
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

type FileOutcome = { kind: 'done'; result: JobResult } | { kind: 'skipped' } | { kind: 'error'; message: string };

const NOT_OVERWRITTEN_WARNING = 'Not overwritten — re-encoded as WAV, written as a new file';

export async function processBatch(
  files: FileEntry[],
  settings: ProcessingSettings,
  outputSink: OutputSink,
  signal: AbortSignal,
): Promise<BatchSummary> {
  const summary = emptySummary();
  const pool = new WorkerPool((fileId, stage) => appState.updateFile(fileId, { stage }));
  const onAbort = () => {
    summary.aborted = true;
    pool.abort();
  };
  signal.addEventListener('abort', onAbort);

  await forEachConcurrent(files, pool.size + DECODE_AHEAD, async (file) => {
    const outcome = await processFile(file, settings, pool, outputSink, signal);
    recordOutcome(file, outcome);
    tally(summary, outcome);
  });
  signal.removeEventListener('abort', onAbort);
  pool.terminate();
  await outputSink.finalize();

  return summary;
}

/** Decode (main thread) -> pipeline (worker) -> write. Never throws: failures become an outcome. */
async function processFile(
  file: FileEntry,
  settings: ProcessingSettings,
  pool: WorkerPool,
  outputSink: OutputSink,
  signal: AbortSignal,
): Promise<FileOutcome> {
  if (signal.aborted) return { kind: 'skipped' };
  appState.updateFile(file.id, { status: 'processing' });
  try {
    const { channels, sampleRate } = await decodeAudioFile(await file.file.arrayBuffer(), file.sourceSampleRate);
    const result = await pool.enqueue({
      fileId: file.id,
      channels,
      sampleRate,
      ...splitNameAndExtension(file.name),
      settings,
      originalBytes: file.size,
      sourceFormat: file.sourceFormat,
      manualTrim: file.manualTrim,
    });
    if (result.aborted) return { kind: 'skipped' };
    return { kind: 'done', result: await writeOutput(file, result, settings, outputSink) };
  } catch (err) {
    return signal.aborted ? { kind: 'skipped' } : { kind: 'error', message: errorMessage(err) };
  }
}

/** Overwrites the source when enabled and possible, else writes to the sink; returns the result with any added warning. */
async function writeOutput(
  file: FileEntry,
  result: JobResult,
  settings: ProcessingSettings,
  outputSink: OutputSink,
): Promise<JobResult> {
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

function recordOutcome(file: FileEntry, outcome: FileOutcome): void {
  switch (outcome.kind) {
    case 'done': {
      const { outputName, stats, warning } = outcome.result;
      appState.updateFile(file.id, { status: 'done', outputName, stats, warning, stage: undefined });
      return;
    }
    case 'skipped':
      appState.updateFile(file.id, { status: 'skipped' });
      return;
    case 'error':
      appState.updateFile(file.id, { status: 'error', error: outcome.message });
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
