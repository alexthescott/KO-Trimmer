import { describe, it, expect } from 'vitest';
import { speedUp, speedUpFrames } from '../../src/audio/speedResample';

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

  it('follows a linear ramp away from the edges (the filter is linear-phase)', () => {
    for (const speed of [1.25, 2, 2.37]) {
      const ramp = Float32Array.from({ length: 2000 }, (_, i) => i / 2000);
      const [out] = speedUp([ramp], speed);
      for (let i = 200; i < out.length - 200; i++) expect(out[i]).toBeCloseTo((i * speed) / 2000, 4);
    }
  });

  it('supports 3x', () => {
    const channel = new Float32Array(900).fill(0.5);
    const [out] = speedUp([channel], 3.0);
    expect(out.length).toBe(300);
    for (const sample of out) expect(sample).toBeCloseTo(0.5, 5); // DC holds right to the edges
  });

  it.each([1.25, 1.4, 2, 3])('removes content pushed above Nyquist at %sx instead of aliasing it', (speed) => {
    // 0.45 cycles/sample at the source lands at 0.45·speed > 0.5 after speeding up.
    const high = Float32Array.from({ length: 8000 }, (_, i) => Math.sin(2 * Math.PI * 0.45 * i));
    const [out] = speedUp([high], speed);
    let peak = 0;
    for (let i = 200; i < out.length - 200; i++) peak = Math.max(peak, Math.abs(out[i]));
    expect(peak).toBeLessThan(1e-3);
  });

  it('keeps content that stays below Nyquist', () => {
    const low = Float32Array.from({ length: 8000 }, (_, i) => Math.sin(2 * Math.PI * 0.05 * i));
    const [out] = speedUp([low], 2);
    let sumSquares = 0;
    for (let i = 200; i < out.length - 200; i++) sumSquares += out[i] * out[i];
    expect(Math.sqrt(sumSquares / (out.length - 400))).toBeCloseTo(Math.SQRT1_2, 3); // full-level sine
  });

  it('applies the same resample to every channel independently', () => {
    const left = Float32Array.from({ length: 1000 }, (_, i) => Math.sin(i / 20));
    const right = left.map((v) => -v);
    const [outLeft, outRight] = speedUp([left, right], 2.0);
    outLeft.forEach((v, i) => expect(outRight[i]).toBeCloseTo(-v, 6));
  });
});

describe('speedUpFrames', () => {
  it('matches the length speedUp actually produces', () => {
    for (const frames of [1, 2, 3, 1000, 44101]) {
      for (const speed of [1.05, 1.5, 2, 2.37, 3]) {
        const [out] = speedUp([new Float32Array(frames)], speed);
        expect(speedUpFrames(frames, speed)).toBe(out.length);
      }
    }
  });

  it('keeps an empty buffer empty', () => {
    expect(speedUpFrames(0, 2)).toBe(0);
    const [out] = speedUp([new Float32Array(0)], 2);
    expect(out.length).toBe(0);
  });
});
