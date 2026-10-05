import { describe, it, expect } from 'vitest';
import { speedUp, speedUpLength } from '../../src/audio/speedResample';

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
    // ramp(i) = i; the centred anti-alias filter is linear-phase, so interior
    // samples land exactly on even indices: 2, 4, 6, ... (edges are clamped).
    const ramp = Float32Array.from({ length: 10 }, (_, i) => i);
    const [out] = speedUp([ramp], 2.0);
    expect(out.length).toBe(5);
    for (let i = 1; i < out.length; i++) {
      expect(out[i]).toBeCloseTo(i * 2, 5);
    }
  });

  it('interpolates without filtering below 1.5x', () => {
    const ramp = Float32Array.from({ length: 20 }, (_, i) => i);
    const [out] = speedUp([ramp], 1.25);
    expect(out.length).toBe(16);
    for (let i = 0; i < out.length; i++) {
      expect(out[i]).toBeCloseTo(i * 1.25, 5);
    }
  });

  it('supports 3x', () => {
    const channel = new Float32Array(900).fill(0.5);
    const [out] = speedUp([channel], 3.0);
    expect(out.length).toBe(300);
    expect(out[150]).toBeCloseTo(0.5, 5);
  });

  it('attenuates source-Nyquist content at 2x instead of aliasing it to DC', () => {
    const nyquist = Float32Array.from({ length: 1000 }, (_, i) => (i % 2 === 0 ? 1 : -1));
    const [out] = speedUp([nyquist], 2.0);
    for (let i = 1; i < out.length; i++) {
      expect(Math.abs(out[i])).toBeLessThan(1e-6);
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

describe('speedUpLength', () => {
  it('matches the length speedUp actually produces', () => {
    for (const frames of [1, 2, 3, 1000, 44101]) {
      for (const speed of [1.05, 1.5, 2, 2.37, 3]) {
        const [out] = speedUp([new Float32Array(frames)], speed);
        expect(speedUpLength(frames, speed)).toBe(out.length);
      }
    }
  });

  it('keeps an empty buffer empty', () => {
    expect(speedUpLength(0, 2)).toBe(0);
    const [out] = speedUp([new Float32Array(0)], 2);
    expect(out.length).toBe(0);
  });
});
