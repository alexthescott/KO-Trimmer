import type { FileEntry, ProcessingSettings } from './types';
import { appState } from './state';
import { decodeAudioFile } from '../audio/decode';
import { WorkerPool } from '../workers/workerPool';
import type { OutputSink } from '../fs/outputWriter';
import { overwriteSourceFile, canOverwrite } from '../fs/overwriteWriter';
import { formatLabel, sameFormat } from '../audio/sampleFormat';

export interface BatchSummary {
  processedCount: number;
  skippedCount: number;
  errorCount: number;
  originalBytes: number;
  outputBytes: number;
  longerThan20sNames: string[];
  /** e.g. { "32-bit float → 16-bit": 14 } */
  formatConversions: Record<string, number>;
  aborted: boolean;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
};

/** Strips the top-level root folder segment, keeping any deeper subfolder structure. */
function deriveOutputRelativePath(file: FileEntry, outputName: string): string {
  const parts = file.relativePath.split('/');
  if (parts.length <= 1) return outputName;
  return [...parts.slice(1, -1), outputName].join('/');
}

function splitNameAndExtension(name: string): { baseName: string; extension: string } {
  const idx = name.lastIndexOf('.');
  if (idx <= 0) return { baseName: name, extension: '' };
  return { baseName: name.slice(0, idx), extension: name.slice(idx + 1).toLowerCase() };
}

export async function processBatch(
  files: FileEntry[],
  settings: ProcessingSettings,
  outputSink: OutputSink,
  signal: AbortSignal,
): Promise<BatchSummary> {
  const summary: BatchSummary = {
    processedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    originalBytes: 0,
    outputBytes: 0,
    longerThan20sNames: [],
    formatConversions: {},
    aborted: false,
  };

  const pool = new WorkerPool((fileId, stage) => appState.updateFile(fileId, { stage }));

  const onAbort = () => {
    summary.aborted = true;
    pool.abort();
  };
  signal.addEventListener('abort', onAbort);

  const tasks = files.map(async (file) => {
    if (signal.aborted) {
      appState.updateFile(file.id, { status: 'skipped' });
      summary.skippedCount++;
      return;
    }

    appState.updateFile(file.id, { status: 'processing' });
    try {
      const arrayBuffer = await file.file!.arrayBuffer();
      const { channels, sampleRate } = await decodeAudioFile(arrayBuffer, file.sourceSampleRate);
      const { baseName, extension } = splitNameAndExtension(file.name);

      const result = await pool.enqueue({
        fileId: file.id,
        channels,
        sampleRate,
        extension,
        baseName,
        settings,
        originalBytes: file.size,
        sourceFormat: file.sourceFormat,
        manualTrim: file.manualTrim,
      });

      if (result.aborted) {
        appState.updateFile(file.id, { status: 'skipped' });
        summary.skippedCount++;
        return;
      }

      if (settings.overwrite && canOverwrite(file.fileHandle)) {
        await overwriteSourceFile(file.fileHandle!, result.bytes);
      } else {
        const relativePath = deriveOutputRelativePath(file, result.outputName);
        await outputSink.write(relativePath, result.bytes);
      }

      const mime = MIME_BY_EXTENSION[result.outputExtension] ?? 'application/octet-stream';
      const blob = new Blob([result.bytes as Uint8Array<ArrayBuffer>], { type: mime });
      const blobUrl = URL.createObjectURL(blob);

      appState.updateFile(file.id, {
        status: 'done',
        outputName: result.outputName,
        stats: result.stats,
        warning: result.warning,
        resultBlob: blob,
        resultBlobUrl: blobUrl,
        stage: undefined,
      });

      summary.processedCount++;
      summary.originalBytes += result.stats.originalBytes;
      summary.outputBytes += result.stats.outputBytes;
      if (result.stats.longerThan20s) summary.longerThan20sNames.push(result.outputName);
      const { sourceFormat, outputFormat } = result.stats;
      if (sourceFormat && outputFormat && !sameFormat(sourceFormat, outputFormat)) {
        const key = `${formatLabel(sourceFormat)} → ${formatLabel(outputFormat)}`;
        summary.formatConversions[key] = (summary.formatConversions[key] ?? 0) + 1;
      }
    } catch (err) {
      if (signal.aborted) {
        appState.updateFile(file.id, { status: 'skipped' });
        summary.skippedCount++;
      } else {
        appState.updateFile(file.id, {
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
        summary.errorCount++;
      }
    }
  });

  await Promise.allSettled(tasks);
  signal.removeEventListener('abort', onAbort);
  pool.terminate();
  await outputSink.finalize();

  return summary;
}
