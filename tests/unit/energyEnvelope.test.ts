import { describe, it, expect } from 'vitest';
import { computeEnergyEnvelope } from '../../src/audio/energyEnvelope';

describe('computeEnergyEnvelope', () => {
  it('returns constant RMS equal to the DC amplitude for a constant-value mono signal', () => {
    const n = 10000;
    const channel = new Float32Array(n).fill(0.5);
    const energy = computeEnergyEnvelope([channel], 2048, 512);

    expect(energy.length).toBe(n);
    for (let i = 0; i < n; i += 500) {
      expect(energy[i]).toBeCloseTo(0.5, 5);
    }
  });

  it('takes the max RMS across channels per frame', () => {
    const n = 10000;
    const quiet = new Float32Array(n).fill(0.1);
    const loud = new Float32Array(n).fill(0.9);
    const energy = computeEnergyEnvelope([quiet, loud], 2048, 512);

    for (let i = 0; i < n; i += 500) {
      expect(energy[i]).toBeCloseTo(0.9, 5);
    }
  });

  it('handles a buffer shorter than one frame without throwing', () => {
    const channel = new Float32Array(100).fill(0.3);
    const energy = computeEnergyEnvelope([channel], 2048, 512);
    expect(energy.length).toBe(100);
    expect(energy[0]).toBeCloseTo(0.3, 5);
  });

  it('matches the direct re-summing algorithm sample for sample, for block-aligned and other frame sizes', () => {
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    const channels = [0, 1].map(() => Float32Array.from({ length: 20_001 }, () => random() * random()));
    for (const [frameLength, hopLength] of [
      [2048, 512],
      [1000, 300],
    ]) {
      const expected = referenceEnvelope(channels, frameLength, hopLength);
      const energy = computeEnergyEnvelope(channels, frameLength, hopLength);
      expect(energy.length).toBe(expected.length);
      let maxDiff = 0;
      for (let i = 0; i < energy.length; i++) maxDiff = Math.max(maxDiff, Math.abs(energy[i] - expected[i]));
      expect(maxDiff).toBeLessThan(1e-6);
    }
  });

  it('returns an empty envelope for empty input', () => {
    expect(computeEnergyEnvelope([new Float32Array(0)]).length).toBe(0);
  });
});

/** The original implementation, which re-sums every overlapping window. */
function referenceEnvelope(channels: Float32Array[], frameLength = 2048, hopLength = 512): Float32Array {
  const n = channels[0]?.length ?? 0;
  if (n === 0) return new Float32Array(0);

  const numFrames = Math.max(1, Math.ceil(n / hopLength));
  const frameRms = new Float32Array(numFrames);

  for (let k = 0; k < numFrames; k++) {
    const start = k * hopLength;
    const end = Math.min(start + frameLength, n);
    const frameLen = Math.max(1, end - start);

    let maxRms = 0;
    for (const channel of channels) {
      let sumSquares = 0;
      for (let i = start; i < end; i++) {
        const sample = channel[i];
        sumSquares += sample * sample;
      }
      const rms = Math.sqrt(sumSquares / frameLen);
      if (rms > maxRms) maxRms = rms;
    }
    frameRms[k] = maxRms;
  }

  if (numFrames === 1) {
    return new Float32Array(n).fill(frameRms[0]);
  }

  // Frame positions spread evenly across [0, n], mirroring np.linspace(0, n, numFrames).
  const framePositions = new Float32Array(numFrames);
  for (let k = 0; k < numFrames; k++) {
    framePositions[k] = (k * n) / (numFrames - 1);
  }

  const energy = new Float32Array(n);
  let frameIdx = 0;
  for (let i = 0; i < n; i++) {
    while (frameIdx < numFrames - 2 && framePositions[frameIdx + 1] < i) {
      frameIdx++;
    }
    const x0 = framePositions[frameIdx];
    const x1 = framePositions[frameIdx + 1];
    const y0 = frameRms[frameIdx];
    const y1 = frameRms[frameIdx + 1];
    if (x1 === x0) {
      energy[i] = y0;
    } else {
      const frac = (i - x0) / (x1 - x0);
      energy[i] = y0 + (y1 - y0) * frac;
    }
  }

  return energy;
}
