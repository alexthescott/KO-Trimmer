import type { FileEntry, ProcessingSettings } from './types';
import { peekDecoded } from './decodedCache';
import { decodeAudioFile, type DecodedAudio } from '../audio/decode';
import { computeAutoTrimBounds } from '../audio/pipeline';
import { estimateOutputBytes, extrapolateBatchEstimate } from '../audio/estimate';

const SAMPLE_LIMIT = 20;

interface FileInfo {
  channels: number;
  sampleRate: number;
  frames: number;
  /** Auto-trimmed frame count, keyed by the detection settings it was computed with. */
  autoFrames: Map<string, number>;
}

/**
 * Whole-batch output size estimate (port of the JUCE BatchEstimateThread):
 * decodes up to 20 files, runs the same auto-trim the pipeline uses, and
 * extrapolates by bytes for the rest. Per-file decode results are reduced
 * to a few numbers and cached, so changing speed/bitrate/stereo never
 * re-decodes; only detection-setting changes do.
 */
export class BatchEstimator {
  private info = new Map<string, FileInfo>();
  private generation = 0;

  async estimate(
    files: FileEntry[],
    settings: ProcessingSettings,
  ): Promise<{ originalBytes: number; estimatedBytes: number; sampled: number } | null> {
    const generation = ++this.generation;
    const detectKey = `${settings.thresholdDb}|${settings.minDurationMs}|${settings.paddingMs}`;
    const candidates = files.filter((f) => f.file).slice(0, SAMPLE_LIMIT);
    const samples: Array<{ originalBytes: number; estimatedBytes: number }> = [];

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
      samples.push({
        originalBytes: file.size,
        estimatedBytes: estimateOutputBytes({
          trimmedFrames,
          sourceChannels: info.channels,
          sourceSampleRate: info.sampleRate,
          extension: extensionOf(file.name),
          settings,
        }),
      });
    }

    if (generation !== this.generation) return null;
    const originalBytes = files.reduce((sum, f) => sum + f.size, 0);
    return {
      originalBytes,
      estimatedBytes: extrapolateBatchEstimate(samples, originalBytes),
      sampled: samples.length,
    };
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
