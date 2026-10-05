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

  it('returns an empty envelope for empty input', () => {
    expect(computeEnergyEnvelope([new Float32Array(0)]).length).toBe(0);
  });
});
