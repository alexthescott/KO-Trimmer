import { describe, it, expect } from 'vitest';
import { resampledFrames, resampleToRate, resolveWavSampleRate } from '../../src/audio/sampleRateResample';

const tone = (hz: number, rate: number, frames: number) =>
  Float32Array.from({ length: frames }, (_, i) => Math.sin((2 * Math.PI * hz * i) / rate));

/** RMS level in dB relative to a full-scale sine, ignoring the edges. */
function levelDb(samples: Float32Array, edge = 200): number {
  let sum = 0;
  for (let i = edge; i < samples.length - edge; i++) sum += samples[i] * samples[i];
  return 20 * Math.log10(Math.sqrt(sum / (samples.length - 2 * edge)) / Math.SQRT1_2);
}

describe('resolveWavSampleRate', () => {
  it('only ever lowers the rate', () => {
    expect(resolveWavSampleRate(44100, 22050)).toBe(22050);
    expect(resolveWavSampleRate(16000, 22050)).toBeUndefined();
    expect(resolveWavSampleRate(44100, null)).toBeUndefined();
  });
});

describe('resampleToRate', () => {
  it('returns the input untouched at the same rate', () => {
    const channels = [tone(440, 44100, 100)];
    expect(resampleToRate(channels, 44100, 44100)).toBe(channels);
  });

  it('produces resampledFrames() frames per channel', () => {
    const out = resampleToRate([tone(440, 44100, 44101), tone(220, 44100, 44101)], 44100, 8000);
    expect(out).toHaveLength(2);
    for (const channel of out) expect(channel.length).toBe(resampledFrames(44101, 44100, 8000));
  });

  it('keeps tones well below the new Nyquist at full level', () => {
    const out = resampleToRate([tone(1000, 44100, 44100)], 44100, 8000)[0];
    expect(Math.abs(levelDb(out))).toBeLessThan(0.05);
  });

  it('removes tones above the new Nyquist instead of aliasing them', () => {
    // 6 kHz would fold to 2 kHz at an 8 kHz output rate.
    const out = resampleToRate([tone(6000, 44100, 44100)], 44100, 8000)[0];
    expect(levelDb(out)).toBeLessThan(-80);
  });

  it('preserves DC right up to the edges', () => {
    const out = resampleToRate([new Float32Array(4410).fill(0.5)], 44100, 11025)[0];
    for (const sample of out) expect(sample).toBeCloseTo(0.5, 5);
  });
});
