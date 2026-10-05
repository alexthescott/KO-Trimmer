import { describe, it, expect } from 'vitest';
import { renderAudible, runPipeline } from '../../src/audio/pipeline';
import { DEFAULT_SETTINGS } from '../../src/audio/settingsDefaults';

const ramp = (n: number) => Float32Array.from({ length: n }, (_, i) => i / n);
const base = { sampleRate: 44100, container: 'wav' as const, settings: DEFAULT_SETTINGS };

describe('renderAudible', () => {
  it('slices to the bounds', async () => {
    const out = await renderAudible({ ...base, channels: [ramp(1000)], bounds: { start: 100, end: 400 } });
    expect(out.channels[0].length).toBe(300);
    expect(out.channels[0][0]).toBeCloseTo(0.1);
  });

  it('downmixes, then speeds up', async () => {
    const out = await renderAudible({
      ...base,
      channels: [ramp(1000), ramp(1000)],
      bounds: { start: 0, end: 1000 },
      settings: { ...DEFAULT_SETTINGS, preserveStereo: false, speedMultiplier: 2 },
    });
    expect(out.channels).toHaveLength(1);
    expect(out.channels[0].length).toBe(500);
  });

  it('lowers the WAV sample rate but never raises it, and never resamples MP3', async () => {
    const settings = { ...DEFAULT_SETTINGS, wavSampleRateHz: 22050 };
    const channels = [ramp(4410)];
    const bounds = { start: 0, end: 4410 };

    const wav = await renderAudible({ ...base, channels, bounds, settings });
    expect(wav.sampleRate).toBe(22050);
    expect(wav.channels[0].length).toBe(2205);

    const low = await renderAudible({ ...base, sampleRate: 16000, channels, bounds, settings });
    expect(low.sampleRate).toBe(16000);

    const mp3 = await renderAudible({ ...base, container: 'mp3', channels, bounds, settings });
    expect(mp3.sampleRate).toBe(44100);
  });
});

describe('runPipeline', () => {
  const input = {
    sampleRate: 1000,
    extension: 'flac',
    baseName: 'loop',
    settings: DEFAULT_SETTINGS,
    originalBytes: 0,
  };

  it('re-encodes non-mp3 sources as wav', async () => {
    const result = await runPipeline({ ...input, channels: [new Float32Array(1000).fill(0.5)] });
    expect(result.outputExtension).toBe('wav');
    expect(result.outputName).toBe('loop_trimmed_stereo.wav');
  });

  it('flags and prefixes outputs over the KO II length limit', async () => {
    const result = await runPipeline({ ...input, channels: [new Float32Array(21_000).fill(0.5)] });
    expect(result.stats.exceedsKoIILength).toBe(true);
    expect(result.outputName.startsWith('_')).toBe(true);
  });
});
