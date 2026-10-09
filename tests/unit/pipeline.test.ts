import { describe, it, expect } from 'vitest';
import { renderAudible, runPipeline } from '../../src/audio/pipeline';
import { DEFAULT_SETTINGS } from '../../src/settings/defaults';
import { NORMALIZE_PEAK } from '../../src/audio/gain';
import { peakAbs } from '../../src/audio/sampleFormat';
import { decodeAiff } from '../../src/audio/aiffDecoder';

const ramp = (n: number) => Float32Array.from({ length: n }, (_, i) => i / n);
const base = { sampleRate: 44100, container: 'wav' as const, settings: DEFAULT_SETTINGS };

describe('renderAudible', () => {
  it('fades only the edges that were trimmed', async () => {
    const settings = { ...DEFAULT_SETTINGS, fadeMs: 1 }; // 44 frames at 44.1 kHz
    const flat = () => [new Float32Array(1000).fill(0.5)];
    const startTrimmed = await renderAudible({
      ...base,
      settings,
      channels: flat(),
      bounds: { start: 100, end: 1000 },
    });
    expect(startTrimmed.channels[0][0]).toBe(0);
    expect(startTrimmed.channels[0].at(-1)).toBe(0.5); // end untouched: nothing was cut there
    const untrimmed = await renderAudible({ ...base, settings, channels: flat(), bounds: { start: 0, end: 1000 } });
    expect(untrimmed.channels[0][0]).toBe(0.5);
  });

  it('normalizes last, after resampling', async () => {
    const settings = { ...DEFAULT_SETTINGS, normalize: true, wavSampleRateHz: 22050 };
    const quiet = [Float32Array.from({ length: 4410 }, (_, i) => 0.1 * Math.sin(i / 8))];
    const out = await renderAudible({ ...base, settings, channels: quiet, bounds: { start: 0, end: 4410 } });
    expect(peakAbs(out.channels)).toBeCloseTo(NORMALIZE_PEAK, 6);
  });

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
      settings: { ...DEFAULT_SETTINGS, preserveStereo: false, speedSemitones: 12 },
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

  it('keeps AIFF sources as AIFF under their own extension, with the sample-rate suffix rule', async () => {
    const settings = { ...DEFAULT_SETTINGS, wavSampleRateHz: 500 };
    const result = await runPipeline({
      ...input,
      extension: 'aif',
      settings,
      channels: [new Float32Array(1000).fill(0.5)],
    });
    expect(result.outputExtension).toBe('aif');
    expect(result.outputName).toBe('loop_trimmed_stereo_500Hz.aif');
    expect(decodeAiff(result.bytes)).toMatchObject({ sampleRate: 500 });
  });

  it('flags and prefixes outputs over the KO II length limit', async () => {
    const result = await runPipeline({ ...input, channels: [new Float32Array(21_000).fill(0.5)] });
    expect(result.stats.exceedsKoIILength).toBe(true);
    expect(result.outputName.startsWith('_')).toBe(true);
  });
});
