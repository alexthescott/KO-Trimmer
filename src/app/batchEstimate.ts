import type { FileEntry, ProcessingSettings } from './types';
import { decodeEntry, peekDecoded } from './decodedCache';
import { computeAutoTrimBounds } from '../audio/pipeline';
import { estimateOutputBytes, extrapolateBatchEstimate, type BatchEstimateSample } from '../audio/estimate';
import { frameCount, type PcmAudio } from '../audio/channels';
import { peakAbs } from '../audio/sampleFormat';
import { extensionOf } from './fileNames';

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
 * Whole-batch output size estimate: decodes every file (one at a time), runs
 * the same auto-trim the pipeline uses, and reports each file's estimate as
 * it lands via `onFile`, plus a running total via `onProgress`. Per-file
 * decode results are reduced to a few numbers and cached, so changing
 * speed/bitrate/stereo never re-decodes; only detection-setting changes do.
 */
export class BatchEstimator {
  private summaries = new Map<string, DecodeSummary>();
  private generation = 0;

  /** Resolves with the final total, or null if superseded by a newer call / cancel(). */
  async estimate(
    files: FileEntry[],
    settings: ProcessingSettings,
    onFile: (id: string, estimate: FileEstimate) => void,
    onProgress: (progress: BatchEstimate) => void,
  ): Promise<BatchEstimate | null> {
    const generation = ++this.generation;
    const detectKey = `${settings.thresholdDb}|${settings.minDurationMs}|${settings.paddingMs}`;
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
        let decoded;
        try {
          decoded = await decodeForEstimate(file);
        } catch {
          continue;
        }
        if (generation !== this.generation) return null;
        info ??= {
          channels: decoded.channels.length,
          sampleRate: decoded.sampleRate,
          frames: frameCount(decoded.channels),
          peak: peakAbs(decoded.channels),
          autoFrames: new Map(),
        };
        const bounds = computeAutoTrimBounds(decoded.channels, decoded.sampleRate, settings);
        info.autoFrames.set(detectKey, bounds.end - bounds.start);
        this.summaries.set(file.id, info);
      }

      const trimmedFrames = file.manualTrim
        ? file.manualTrim.end - file.manualTrim.start
        : info.autoFrames.get(detectKey) ?? info.frames;
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

/** Reuses the editor's decoded audio when it's already in memory. */
function decodeForEstimate(file: FileEntry): Promise<PcmAudio> {
  return peekDecoded(file.id) ?? decodeEntry(file);
}
