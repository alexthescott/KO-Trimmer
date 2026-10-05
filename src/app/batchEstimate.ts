import type { FileEntry, ProcessingSettings } from './types';
import { peekDecoded } from './decodedCache';
import { decodeAudioFile, type DecodedAudio } from '../audio/decode';
import { computeAutoTrimBounds } from '../audio/pipeline';
import { estimateOutputBytes, extrapolateBatchEstimate } from '../audio/estimate';

interface FileInfo {
  channels: number;
  sampleRate: number;
  frames: number;
  /** Auto-trimmed frame count, keyed by the detection settings it was computed with. */
  autoFrames: Map<string, number>;
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
  private info = new Map<string, FileInfo>();
  private generation = 0;

  /** Resolves with the final total, or null if superseded by a newer call / cancel(). */
  async estimate(
    files: FileEntry[],
    settings: ProcessingSettings,
    onFile: (id: string, estimatedBytes: number) => void,
    onProgress: (progress: BatchEstimate) => void,
  ): Promise<BatchEstimate | null> {
    const generation = ++this.generation;
    const detectKey = `${settings.thresholdDb}|${settings.minDurationMs}|${settings.paddingMs}`;
    const candidates = files.filter((f) => f.file);
    const originalBytes = files.reduce((sum, f) => sum + f.size, 0);
    const samples: Array<{ originalBytes: number; estimatedBytes: number }> = [];
    const summarize = (): BatchEstimate => ({
      originalBytes,
      estimatedBytes: extrapolateBatchEstimate(samples, originalBytes),
      analysed: samples.length,
      total: files.length,
    });

    for (const file of candidates) {
      let info = this.info.get(file.id);
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
          frames: decoded.channels[0]?.length ?? 0,
          autoFrames: new Map(),
        };
        const bounds = computeAutoTrimBounds(decoded.channels, decoded.sampleRate, settings);
        info.autoFrames.set(detectKey, bounds.end - bounds.start);
        this.info.set(file.id, info);
      }

      const trimmedFrames = file.manualTrim
        ? file.manualTrim.end - file.manualTrim.start
        : info.autoFrames.get(detectKey) ?? info.frames;
      const estimatedBytes = estimateOutputBytes({
        trimmedFrames,
        sourceChannels: info.channels,
        sourceSampleRate: info.sampleRate,
        extension: extensionOf(file.name),
        settings,
      });
      samples.push({ originalBytes: file.size, estimatedBytes });
      onFile(file.id, estimatedBytes);
      onProgress(summarize());
    }

    if (generation !== this.generation) return null;
    return summarize();
  }

  forget(liveIds: Set<string>): void {
    for (const id of this.info.keys()) if (!liveIds.has(id)) this.info.delete(id);
  }

  cancel(): void {
    this.generation++;
  }
}

/** Reuses the editor's decoded audio when it's already in memory. */
async function decodeForEstimate(file: FileEntry): Promise<DecodedAudio> {
  return peekDecoded(file.id) ?? decodeAudioFile(await file.file!.arrayBuffer());
}

function extensionOf(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx > 0 ? name.slice(idx + 1).toLowerCase() : '';
}
