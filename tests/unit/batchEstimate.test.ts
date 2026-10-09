import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FileEntry } from '../../src/app/types';
import { DEFAULT_SETTINGS } from '../../src/settings/defaults';
import { computeAutoTrimBounds, type DetectionSettings } from '../../src/audio/autoTrim';
import { analyseAudio } from '../../src/audio/analysis';
import { BatchEstimator } from '../../src/app/batchEstimate';
import { NORMALIZE_PEAK } from '../../src/audio/gain';

/** Stands in for the analysis worker: the same pure analysis, on a fixed decode. */
const analyse = vi.fn<(file: FileEntry, detection: DetectionSettings) => Promise<ReturnType<typeof analyseAudio>>>();

/** 1 s of silence, 1 s of tone, 1 s of silence at 8 kHz. */
function paddedTone() {
  const rate = 8000;
  const samples = new Float32Array(rate * 3);
  for (let i = rate; i < rate * 2; i++) samples[i] = 0.5 * Math.sin(i / 4);
  return { channels: [samples], sampleRate: rate };
}

function entry(id: string, extra: Partial<FileEntry> = {}): FileEntry {
  return {
    id,
    name: `${id}.wav`,
    relativePath: `${id}.wav`,
    size: 48_044,
    file: new File([], `${id}.wav`),
    status: 'queued',
    sourceFormat: { bits: 16, float: false },
    ...extra,
  };
}

const noop = () => {};

describe('BatchEstimator', () => {
  beforeEach(() => {
    analyse.mockReset();
    analyse.mockImplementation(async (_file, detection) => analyseAudio(paddedTone(), detection));
  });

  it('estimates with the pipeline auto-trim and reports each file as it lands', async () => {
    const { channels, sampleRate } = paddedTone();
    const { start, end } = computeAutoTrimBounds(channels, sampleRate, DEFAULT_SETTINGS);
    const perFile = vi.fn();
    const result = await new BatchEstimator(analyse).estimate([entry('a')], DEFAULT_SETTINGS, perFile, noop);
    expect(perFile).toHaveBeenCalledWith('a', { bytes: 44 + (end - start) * 2, peak: expect.any(Number) });
    expect(end - start).toBeLessThan(channels[0].length);
    expect(result).toMatchObject({ analysed: 1, total: 1, estimatedBytes: 44 + (end - start) * 2 });
  });

  it('re-analyses only when detection settings change, passing just the detection settings', async () => {
    const estimator = new BatchEstimator(analyse);
    const files = [entry('a')];
    await estimator.estimate(files, DEFAULT_SETTINGS, noop, noop);
    await estimator.estimate(files, { ...DEFAULT_SETTINGS, speedMultiplier: 2, preserveStereo: false }, noop, noop);
    expect(analyse).toHaveBeenCalledTimes(1);
    await estimator.estimate(files, { ...DEFAULT_SETTINGS, thresholdDb: -30 }, noop, noop);
    expect(analyse).toHaveBeenCalledTimes(2);
    expect(analyse.mock.calls[1][1]).toEqual({ thresholdDb: -30, minDurationMs: 10, paddingMs: 20 });
  });

  it('uses a manual trim without re-detecting', async () => {
    const estimator = new BatchEstimator(analyse);
    await estimator.estimate([entry('a')], DEFAULT_SETTINGS, noop, noop);
    const perFile = vi.fn();
    const manual = entry('a', { manualTrim: { start: 0, end: 8000 } });
    await estimator.estimate([manual], { ...DEFAULT_SETTINGS, thresholdDb: -20 }, perFile, noop);
    expect(analyse).toHaveBeenCalledTimes(1);
    expect(perFile.mock.calls[0][1].bytes).toBe(44 + 8000 * 2);
  });

  it('extrapolates over files that fail to decode', async () => {
    analyse.mockImplementation(async (file, detection) => {
      if (file.id === 'bad') throw new Error('unsupported');
      return analyseAudio(paddedTone(), detection);
    });
    const perFile = vi.fn();
    const result = await new BatchEstimator(analyse).estimate(
      [entry('good'), entry('bad')],
      DEFAULT_SETTINGS,
      perFile,
      noop,
    );
    const goodBytes = perFile.mock.calls[0][1].bytes;
    // Same-sized sources, so the undecodable one is assumed to shrink by the same ratio.
    expect(result).toMatchObject({ analysed: 1, total: 2, estimatedBytes: 2 * goodBytes });
  });

  it('predicts the normalized peak (for the clip tag and float-size estimate) when Normalize is on', async () => {
    const perFile = vi.fn();
    await new BatchEstimator(analyse).estimate([entry('a')], { ...DEFAULT_SETTINGS, normalize: true }, perFile, noop);
    expect(perFile.mock.calls[0][1].peak).toBe(NORMALIZE_PEAK);
  });

  it('resolves null when superseded by cancel()', async () => {
    const estimator = new BatchEstimator(analyse);
    const pending = estimator.estimate([entry('a')], DEFAULT_SETTINGS, noop, noop);
    estimator.cancel();
    expect(await pending).toBeNull();
  });
});
