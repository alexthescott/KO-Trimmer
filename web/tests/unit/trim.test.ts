import { describe, it, expect } from 'vitest';
import { computeTrimBounds, sliceChannels } from '../../src/audio/trim';
import type { SilenceRegion } from '../../src/app/types';

const SAMPLE_RATE = 1000; // 1 sample == 1ms

describe('computeTrimBounds', () => {
  it('returns full bounds untouched when there are no silence regions', () => {
    expect(computeTrimBounds(100, [], SAMPLE_RATE, 0)).toEqual({ start: 0, end: 100 });
  });

  it('trims only the trailing edge when silence is anchored at the end, leaving the rest', () => {
    const regions: SilenceRegion[] = [{ start: 80, end: 99, duration: 20 }];
    expect(computeTrimBounds(100, regions, SAMPLE_RATE, 0)).toEqual({ start: 0, end: 80 });
  });

  it('trims only the leading edge when silence is anchored at the start', () => {
    const regions: SilenceRegion[] = [{ start: 0, end: 19, duration: 20 }];
    expect(computeTrimBounds(100, regions, SAMPLE_RATE, 0)).toEqual({ start: 20, end: 100 });
  });

  it('trims BOTH leading and trailing silence (the desktop-app bug fix)', () => {
    const regions: SilenceRegion[] = [
      { start: 0, end: 9, duration: 10 },
      { start: 40, end: 49, duration: 10 }, // internal — must survive untouched
      { start: 90, end: 99, duration: 10 },
    ];
    expect(computeTrimBounds(100, regions, SAMPLE_RATE, 0)).toEqual({ start: 10, end: 90 });
  });

  it('never touches an internal-only region (not anchored to either edge)', () => {
    const regions: SilenceRegion[] = [{ start: 40, end: 49, duration: 10 }];
    expect(computeTrimBounds(100, regions, SAMPLE_RATE, 0)).toEqual({ start: 0, end: 100 });
  });

  it('applies padding around the trimmed content, clamped to valid bounds', () => {
    const regions: SilenceRegion[] = [
      { start: 0, end: 9, duration: 10 },
      { start: 90, end: 99, duration: 10 },
    ];
    // paddingMs=5 at sampleRate=1000 -> 5 samples of padding each side
    expect(computeTrimBounds(100, regions, SAMPLE_RATE, 5)).toEqual({ start: 5, end: 95 });
  });

  it('clamps padding so it cannot extend past the original buffer bounds', () => {
    const regions: SilenceRegion[] = [
      { start: 0, end: 4, duration: 5 },
      { start: 95, end: 99, duration: 5 },
    ];
    expect(computeTrimBounds(100, regions, SAMPLE_RATE, 50)).toEqual({ start: 0, end: 100 });
  });

  it('falls back to full bounds with a warning when the entire file is silent', () => {
    const regions: SilenceRegion[] = [{ start: 0, end: 99, duration: 100 }];
    const result = computeTrimBounds(100, regions, SAMPLE_RATE, 0);
    expect(result.start).toBe(0);
    expect(result.end).toBe(100);
    expect(result.warning).toBeTruthy();
  });
});

describe('sliceChannels', () => {
  it('slices every channel to the given bounds', () => {
    const left = Float32Array.from([1, 2, 3, 4, 5]);
    const right = Float32Array.from([5, 4, 3, 2, 1]);
    const [slicedLeft, slicedRight] = sliceChannels([left, right], { start: 1, end: 4 });
    expect(Array.from(slicedLeft)).toEqual([2, 3, 4]);
    expect(Array.from(slicedRight)).toEqual([4, 3, 2]);
  });
});
