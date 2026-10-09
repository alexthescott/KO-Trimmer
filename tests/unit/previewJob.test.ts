import { describe, it, expect } from 'vitest';
import { renderPreviewJob } from '../../src/audio/previewJob';
import { DEFAULT_SETTINGS } from '../../src/settings/defaults';

const tone = () => [Float32Array.from({ length: 44100 }, (_, i) => 0.5 * Math.sin(i / 10))];
const input = (container: 'wav' | 'mp3', settings = DEFAULT_SETTINGS) => ({
  channels: tone(),
  sampleRate: 44100,
  bounds: { start: 0, end: 44100 },
  container,
  settings,
});

describe('renderPreviewJob', () => {
  it('returns rendered PCM for WAV output, with the same stages as the batch', async () => {
    const result = await renderPreviewJob(input('wav', { ...DEFAULT_SETTINGS, wavSampleRateHz: 22050 }));
    expect(result.kind).toBe('pcm');
    if (result.kind === 'pcm') expect(result.audio).toMatchObject({ sampleRate: 22050 });
  });

  it('returns PCM for full-bitrate MP3, where encoder artifacts are inaudible', async () => {
    expect((await renderPreviewJob(input('mp3'))).kind).toBe('pcm');
  });

  it('returns real MP3 bytes below full bitrate so the preview carries the artifacts', async () => {
    const result = await renderPreviewJob(input('mp3', { ...DEFAULT_SETTINGS, bitrateKbps: 64 }));
    expect(result.kind).toBe('mp3');
    if (result.kind === 'mp3') {
      expect(result.sampleRate).toBe(44100);
      expect(result.bytes.length).toBeGreaterThan(1000);
    }
  });
});
