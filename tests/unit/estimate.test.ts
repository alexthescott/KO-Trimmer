import { describe, it, expect } from 'vitest';
import { estimateOutputBytes, extrapolateBatchEstimate } from '../../src/audio/estimate';
import { encodeWav } from '../../src/audio/wavEncoder';
import { encodeAiff } from '../../src/audio/aiffEncoder';
import { speedUp } from '../../src/audio/speedResample';
import { runPipeline } from '../../src/audio/pipeline';
import { DEFAULT_SETTINGS } from '../../src/settings/defaults';

const base = { speedMultiplier: 1.0, preserveStereo: true, bitrateKbps: 320 as const };

describe('estimateOutputBytes', () => {
  it('matches a 16-bit stereo WAV byte count exactly', () => {
    const est = estimateOutputBytes({
      trimmedFrames: 44100,
      sourceChannels: 2,
      sourceSampleRate: 44100,
      extension: 'wav',
      settings: base,
    });
    const actual = encodeWav([new Float32Array(44100), new Float32Array(44100)], 44100).length;
    expect(est).toBe(actual);
  });

  it('matches encodeAiff byte counts exactly, including AIFC float and the odd-size pad', () => {
    for (const [format, frames] of [
      [{ bits: 16, float: false }, 1000],
      [{ bits: 8, float: false }, 1001],
      [{ bits: 32, float: true }, 1000],
    ] as const) {
      const est = estimateOutputBytes({
        trimmedFrames: frames,
        sourceChannels: 1,
        sourceSampleRate: 44100,
        extension: 'aif',
        sourceFormat: format,
        settings: { ...base, preserveBitDepth: true },
      });
      expect(est).toBe(encodeAiff([new Float32Array(frames)], 44100, format).length);
    }
  });

  it('halves channels when downmixing to mono', () => {
    const est = estimateOutputBytes({
      trimmedFrames: 1000,
      sourceChannels: 2,
      sourceSampleRate: 44100,
      extension: 'wav',
      settings: { ...base, preserveStereo: false },
    });
    expect(est).toBe(44 + 1000 * 2);
  });

  it('matches speedUp output length', () => {
    for (const speed of [1.3, 2.0, 2.7, 3.0]) {
      const frames = 12345;
      const [sped] = speedUp([new Float32Array(frames)], speed);
      const est = estimateOutputBytes({
        trimmedFrames: frames,
        sourceChannels: 1,
        sourceSampleRate: 48000,
        extension: 'wav',
        settings: { ...base, speedMultiplier: speed },
      });
      expect(est).toBe(44 + sped.length * 2);
    }
  });

  it('applies the WAV sample-rate setting, ignoring MP3 bitrate', () => {
    const est = estimateOutputBytes({
      trimmedFrames: 44100,
      sourceChannels: 1,
      sourceSampleRate: 44100,
      extension: 'wav',
      settings: { ...base, wavSampleRateHz: 22050 },
    });
    expect(est).toBe(44 + 22050 * 2);
    const bitrateOnly = estimateOutputBytes({
      trimmedFrames: 44100,
      sourceChannels: 1,
      sourceSampleRate: 44100,
      extension: 'wav',
      settings: { ...base, bitrateKbps: 64 },
    });
    expect(bitrateOnly).toBe(44 + 44100 * 2);
  });

  it('never upsamples WAV', () => {
    const est = estimateOutputBytes({
      trimmedFrames: 22050,
      sourceChannels: 1,
      sourceSampleRate: 22050,
      extension: 'wav',
      settings: { ...base, wavSampleRateHz: 44100 },
    });
    expect(est).toBe(44 + 22050 * 2);
  });

  it('uses CBR bitrate for MP3', () => {
    const est = estimateOutputBytes({
      trimmedFrames: 88200,
      sourceChannels: 2,
      sourceSampleRate: 44100,
      extension: 'mp3',
      settings: { ...base, bitrateKbps: 128 },
    });
    expect(est).toBe(32000); // 2s * 128kbps / 8
  });
});

describe('extrapolateBatchEstimate', () => {
  it('returns the exact sum when every file was sampled', () => {
    expect(extrapolateBatchEstimate([{ originalBytes: 100, estimatedBytes: 40 }], 100)).toBe(40);
  });

  it('scales the sampled ratio to the unsampled remainder', () => {
    const samples = [{ originalBytes: 100, estimatedBytes: 50 }];
    expect(extrapolateBatchEstimate(samples, 1000)).toBe(500);
  });
});

describe('runPipeline manualTrim', () => {
  it('uses manual trim points instead of auto-detection', async () => {
    const channel = new Float32Array(44100).fill(0.5);
    const result = await runPipeline({
      channels: [channel],
      sampleRate: 44100,
      extension: 'wav',
      baseName: 'x',
      settings: DEFAULT_SETTINGS,
      originalBytes: 0,
      manualTrim: { start: 1000, end: 5410 },
    });
    expect(result.bytes.length).toBe(44 + 4410 * 2);
    expect(result.stats.outputDurationSec).toBeCloseTo(0.1, 5);
  });
});
