import { describe, it, expect } from 'vitest';
import { speedUp } from '../../src/audio/speedResample';

describe('speedUp', () => {
  it('is a no-op at 1.0x', () => {
    const channel = Float32Array.from([1, 2, 3, 4]);
    const [out] = speedUp([channel], 1.0);
    expect(out).toBe(channel);
  });

  it('shortens output length by the speed multiplier', () => {
    const channel = new Float32Array(1000).fill(1);
    const [out] = speedUp([channel], 2.0);
    expect(out.length).toBe(500);
  });

  it('interpolates values along a linear ramp', () => {
    // ramp(i) = i, speeding up 2x should sample at even indices: 0, 2, 4, ...
    const ramp = Float32Array.from({ length: 10 }, (_, i) => i);
    const [out] = speedUp([ramp], 2.0);
    expect(out.length).toBe(5);
    for (let i = 0; i < out.length; i++) {
      expect(out[i]).toBeCloseTo(i * 2, 5);
    }
  });

  it('applies the same resample to every channel independently', () => {
    const left = Float32Array.from({ length: 10 }, (_, i) => i);
    const right = Float32Array.from({ length: 10 }, (_, i) => -i);
    const [outLeft, outRight] = speedUp([left, right], 2.0);
    expect(outLeft[1]).toBeCloseTo(2, 5);
    expect(outRight[1]).toBeCloseTo(-2, 5);
  });
});
