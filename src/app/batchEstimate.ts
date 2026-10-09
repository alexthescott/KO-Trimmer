import type { FileEntry, ProcessingSettings } from './types';
import type { AudioAnalysis } from '../audio/analysis';
import type { DetectionSettings } from '../audio/autoTrim';
import { estimateOutputBytes, extrapolateBatchEstimate, type BatchEstimateSample } from '../audio/estimate';
import { extensionOf } from './fileNames';
import { analyseEntry } from './analysisClient';

/** Decodes + auto-trims one file for the estimate; the analysis worker in the app, a fake in tests. */
export type Analyser = (file: FileEntry, detection: DetectionSettings) => Promise<AudioAnalysis>;

/** What the estimate needs from one decode, kept instead of the PCM itself. */
interface DecodeSummary {
  channels: number;
  sampleRate: number;
  frames: number;
  /** Absolute source peak — trimming only drops silence, so it stands in for the output's. */
  peak: number;
  /** Auto-trimmed frame count, keyed by the detection settings it was computed with. */
  autoFrames: Map<string, number>;
}

export interface FileEstimate {
  bytes: number;
  peak: number;
}

export interface BatchEstimate {
  originalBytes: number;
  /** Sum of per-file estimates, extrapolated by bytes over any not yet (or not) decodable. */
  estimatedBytes: number;
  /** Files with a per-file estimate so far. */
  analysed: number;
  total: number;
}

/**
 * Whole-batch output size estimate: analyses every file (one at a time, in
 * a worker), running the same auto-trim the pipeline uses, and reports each
 * file's estimate as it lands via `onFile`, plus a running total via
 * `onProgress`. Per-file results are a few numbers, cached, so changing
 * speed/bitrate/stereo never re-decodes; only detection-setting changes do.
 */
export class BatchEstimator {
  private summaries = new Map<string, DecodeSummary>();
  private generation = 0;

  constructor(private readonly analyse: Analyser = analyseEntry) {}

  /** Resolves with the final total, or null if superseded by a newer call / cancel(). */
  async estimate(
    files: FileEntry[],
    settings: ProcessingSettings,
    onFile: (id: string, estimate: FileEstimate) => void,
    onProgress: (progress: BatchEstimate) => void,
  ): Promise<BatchEstimate | null> {
    const generation = ++this.generation;
    const { thresholdDb, minDurationMs, paddingMs } = settings;
    const detection: DetectionSettings = { thresholdDb, minDurationMs, paddingMs };
    const detectKey = `${thresholdDb}|${minDurationMs}|${paddingMs}`;
    const originalBytes = files.reduce((sum, f) => sum + f.size, 0);
    const samples: BatchEstimateSample[] = [];
    const summarize = (): BatchEstimate => ({
      originalBytes,
      estimatedBytes: extrapolateBatchEstimate(samples, originalBytes),
      analysed: samples.length,
      total: files.length,
    });

    for (const file of files) {
      let info = this.summaries.get(file.id);
      const needsAuto = !file.manualTrim && !info?.autoFrames.has(detectKey);
      if (!info || needsAuto) {
        let analysis;
        try {
          analysis = await this.analyse(file, detection);
        } catch {
          continue;
        }
        if (generation !== this.generation) return null;
        const { autoFrames, ...source } = analysis;
        info ??= { ...source, autoFrames: new Map() };
        info.autoFrames.set(detectKey, autoFrames);
        this.summaries.set(file.id, info);
      }

      const trimmedFrames = file.manualTrim
        ? file.manualTrim.end - file.manualTrim.start
        : (info.autoFrames.get(detectKey) ?? info.frames);
      const estimatedBytes = estimateOutputBytes({
        trimmedFrames,
        sourceChannels: info.channels,
        sourceSampleRate: info.sampleRate,
        extension: extensionOf(file.name),
        sourceFormat: file.sourceFormat,
        peak: info.peak,
        settings,
      });
      samples.push({ originalBytes: file.size, estimatedBytes });
      onFile(file.id, { bytes: estimatedBytes, peak: info.peak });
      onProgress(summarize());
    }

    if (generation !== this.generation) return null;
    return summarize();
  }

  forget(liveIds: Set<string>): void {
    for (const id of this.summaries.keys()) if (!liveIds.has(id)) this.summaries.delete(id);
  }

  cancel(): void {
    this.generation++;
  }
}
