import { describe, it, expect } from 'vitest';
import { fadeEdges, normalizePeak, NORMALIZE_PEAK, predictedOutputPeak } from '../../src/audio/gain';
import { peakAbs } from '../../src/audio/sampleFormat';

describe('normalizePeak', () => {
  it('scales quiet and over-full-scale audio to the target peak, keeping shape', () => {
    for (const scale of [0.1, 2.5]) {
      const channels = [Float32Array.from([0, 0.5, -1, 0.25].map((v) => v * scale))];
      const [out] = normalizePeak(channels);
      expect(peakAbs([out])).toBeCloseTo(NORMALIZE_PEAK, 6);
      expect(out[1] / out[2]).toBeCloseTo(-0.5, 6);
    }
  });

  it('applies one gain across all channels (keeps the stereo balance)', () => {
    const [left, right] = normalizePeak([Float32Array.from([0.5]), Float32Array.from([0.25])]);
    expect(left[0] / right[0]).toBeCloseTo(2, 6);
  });

  it('leaves silence untouched', () => {
    const silent = [new Float32Array(4)];
    expect(normalizePeak(silent)).toBe(silent);
  });
});

describe('predictedOutputPeak', () => {
  it('is the normalize target when normalizing anything audible, else the source peak', () => {
    expect(predictedOutputPeak(1.8, true)).toBe(NORMALIZE_PEAK);
    expect(predictedOutputPeak(1.8, false)).toBe(1.8);
    expect(predictedOutputPeak(0, true)).toBe(0);
  });
});

describe('fadeEdges', () => {
  const ones = () => [new Float32Array(10).fill(1)];

  it('ramps linearly from silence in and down to silence out', () => {
    const [out] = fadeEdges(ones(), 4, 4);
    expect(Array.from(out)).toEqual([0, 0.25, 0.5, 0.75, 1, 1, 0.75, 0.5, 0.25, 0]);
  });

  it('fades only the requested edges and never writes to its input', () => {
    const input = ones();
    const [inOnly] = fadeEdges(input, 2, 0);
    expect(Array.from(inOnly)).toEqual([0, 0.5, 1, 1, 1, 1, 1, 1, 1, 1]);
    expect(input[0][0]).toBe(1);
  });

  it('caps each fade at half the buffer', () => {
    const [out] = fadeEdges([new Float32Array(4).fill(1)], 100, 100);
    expect(Array.from(out)).toEqual([0, 0.5, 0.5, 0]);
  });
});
