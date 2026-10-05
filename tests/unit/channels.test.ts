import { describe, it, expect } from 'vitest';
import { floatToInt, frameCount, sampleAt } from '../../src/audio/channels';
import { downmixToMono } from '../../src/audio/mono';

describe('frameCount', () => {
  it('is the first channel length, or 0 with no channels', () => {
    expect(frameCount([new Float32Array(5), new Float32Array(5)])).toBe(5);
    expect(frameCount([])).toBe(0);
  });
});

describe('sampleAt', () => {
  const ch = Float32Array.from([0, 1, 0.5]);
  it('interpolates between neighbours', () => {
    expect(sampleAt(ch, 0.5)).toBeCloseTo(0.5);
    expect(sampleAt(ch, 1.5)).toBeCloseTo(0.75);
  });
  it('clamps positions outside the channel to its ends', () => {
    expect(sampleAt(ch, -3)).toBe(0);
    expect(sampleAt(ch, 99)).toBe(0.5);
  });
});

describe('floatToInt', () => {
  it('scales asymmetrically and clamps to full scale', () => {
    expect(floatToInt(1, 0x8000, 0x7fff)).toBe(0x7fff);
    expect(floatToInt(-1, 0x8000, 0x7fff)).toBe(-0x8000);
    expect(floatToInt(2, 0x8000, 0x7fff)).toBe(0x7fff);
    expect(floatToInt(-2, 0x8000, 0x7fff)).toBe(-0x8000);
  });
});

describe('downmixToMono', () => {
  it('averages channels and leaves mono untouched', () => {
    const [mono] = downmixToMono([Float32Array.from([1, 0]), Float32Array.from([0, 0.5])]);
    expect(Array.from(mono)).toEqual([0.5, 0.25]);
    const single = [new Float32Array(3)];
    expect(downmixToMono(single)).toBe(single);
  });
});
