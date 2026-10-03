import { describe, it, expect } from 'vitest';
import { detectSilenceRegions } from '../../src/audio/silenceDetector';
import { concat } from '../fixtures/synthesize';

// sampleRate=1000 makes 1 sample == 1ms, so minDurationMs maps 1:1 to sample counts.
const SAMPLE_RATE = 1000;
const THRESHOLD_DB = -20; // thresholdLinear = 10^(-20/20) = 0.1
const MIN_DURATION_MS = 5;

const SILENT = 0.01;
const LOUD = 0.5;

function fill(value: number, n: number): Float32Array {
  return new Float32Array(n).fill(value);
}

describe('detectSilenceRegions', () => {
  it('finds no regions in a fully loud signal', () => {
    const energy = fill(LOUD, 100);
    expect(detectSilenceRegions(energy, SAMPLE_RATE, THRESHOLD_DB, MIN_DURATION_MS)).toEqual([]);
  });

  it('detects the whole buffer as one region when fully silent', () => {
    const energy = fill(SILENT, 100);
    const regions = detectSilenceRegions(energy, SAMPLE_RATE, THRESHOLD_DB, MIN_DURATION_MS);
    expect(regions).toEqual([{ start: 0, end: 99, duration: 100 }]);
  });

  it('detects leading-only silence', () => {
    const energy = concat(fill(SILENT, 20), fill(LOUD, 80));
    const regions = detectSilenceRegions(energy, SAMPLE_RATE, THRESHOLD_DB, MIN_DURATION_MS);
    expect(regions).toEqual([{ start: 0, end: 19, duration: 20 }]);
  });

  it('detects trailing-only silence', () => {
    const energy = concat(fill(LOUD, 80), fill(SILENT, 20));
    const regions = detectSilenceRegions(energy, SAMPLE_RATE, THRESHOLD_DB, MIN_DURATION_MS);
    expect(regions).toEqual([{ start: 80, end: 99, duration: 20 }]);
  });

  it('detects both leading and trailing silence, preserving an internal gap as a third region', () => {
    const energy = concat(
      fill(SILENT, 10), // leading
      fill(LOUD, 30),
      fill(SILENT, 10), // internal
      fill(LOUD, 30),
      fill(SILENT, 10), // trailing
    );
    const regions = detectSilenceRegions(energy, SAMPLE_RATE, THRESHOLD_DB, MIN_DURATION_MS);
    expect(regions).toEqual([
      { start: 0, end: 9, duration: 10 },
      { start: 40, end: 49, duration: 10 },
      { start: 80, end: 89, duration: 10 },
    ]);
  });

  it('drops silence runs shorter than the minimum duration', () => {
    const energy = concat(fill(SILENT, 2), fill(LOUD, 98)); // 2ms < 5ms minimum
    const regions = detectSilenceRegions(energy, SAMPLE_RATE, THRESHOLD_DB, MIN_DURATION_MS);
    expect(regions).toEqual([]);
  });

  it('returns an empty list for empty energy input', () => {
    expect(detectSilenceRegions(new Float32Array(0), SAMPLE_RATE, THRESHOLD_DB, MIN_DURATION_MS)).toEqual([]);
  });
});
