import { describe, it, expect } from 'vitest';
import {
  clipWarning,
  parseSampleFormat,
  resolveOutputFormat,
  PCM16,
} from '../../src/audio/sampleFormat';
import { encodeWav } from '../../src/audio/wavEncoder';
import { estimateOutputBytes } from '../../src/audio/estimate';
import { runPipeline } from '../../src/audio/pipeline';
import { DEFAULT_SETTINGS } from '../../src/audio/settingsDefaults';

const FLOAT32 = { bits: 32, float: true };
const PCM24 = { bits: 24, float: false };

function bytesOf(...parts: Array<string | number[]>): Uint8Array {
  const out: number[] = [];
  for (const p of parts) {
    if (typeof p === 'string') for (const c of p) out.push(c.charCodeAt(0));
    else out.push(...p);
  }
  return new Uint8Array(out);
}
const u32le = (v: number) => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff];
const u16le = (v: number) => [v & 0xff, (v >> 8) & 0xff];
const u32be = (v: number) => u32le(v).reverse();
const u16be = (v: number) => u16le(v).reverse();

describe('parseSampleFormat', () => {
  it('reads the formats encodeWav writes', () => {
    const ch = [new Float32Array(8)];
    for (const format of [PCM16, PCM24, FLOAT32, { bits: 8, float: false }, { bits: 32, float: false }]) {
      expect(parseSampleFormat(encodeWav(ch, 44100, format))).toEqual(format);
    }
  });

  it('skips chunks before fmt and reads WAVE_FORMAT_EXTENSIBLE sub-format + valid bits', () => {
    const fmt = [
      ...u16le(0xfffe), ...u16le(2), ...u32le(48000), ...u32le(0), ...u16le(8), ...u16le(32),
      ...u16le(22), ...u16le(24), ...u32le(3), ...u16le(1), ...new Array(14).fill(0),
    ];
    const wav = bytesOf('RIFF', u32le(0), 'WAVE', 'JUNK', u32le(3), [0, 0, 0, 0], 'fmt ', u32le(40), fmt);
    expect(parseSampleFormat(wav)).toEqual(PCM24);
  });

  it('reads AIFF and AIFC float', () => {
    const comm = (extra: number[]) => [...u16be(2), ...u32be(0), ...u16be(24), ...new Array(10).fill(0), ...extra];
    expect(parseSampleFormat(bytesOf('FORM', u32be(0), 'AIFF', 'COMM', u32be(18), comm([])))).toEqual(PCM24);
    const aifc = bytesOf('FORM', u32be(0), 'AIFC', 'COMM', u32be(22), comm([...bytesOf('fl32')]));
    expect(parseSampleFormat(aifc)).toEqual(FLOAT32);
  });

  it('reads FLAC STREAMINFO bits per sample', () => {
    // 44100 Hz, 2 ch, 24 bps: bytes 10-13 = 0x0A 0xC4 0x43 0x70
    const info = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x0a, 0xc4, 0x43, 0x70, ...new Array(20).fill(0)];
    expect(parseSampleFormat(bytesOf('fLaC', [0, 0, 0, 34], info))).toEqual(PCM24);
  });

  it('returns undefined for unknown or compressed input', () => {
    expect(parseSampleFormat(bytesOf('ID3', [4, 0, 0, 0, 0, 0, 0]))).toBeUndefined();
    const adpcm = bytesOf('RIFF', u32le(0), 'WAVE', 'fmt ', u32le(16), [...u16le(2), ...new Array(14).fill(0)]);
    expect(parseSampleFormat(adpcm)).toBeUndefined();
  });
});

describe('resolveOutputFormat', () => {
  it('defaults to 16-bit unless preserving a known format', () => {
    expect(resolveOutputFormat(FLOAT32, false)).toEqual(PCM16);
    expect(resolveOutputFormat(undefined, true)).toEqual(PCM16);
    expect(resolveOutputFormat(FLOAT32, true)).toEqual(FLOAT32);
    expect(resolveOutputFormat({ bits: 64, float: true }, true)).toEqual(FLOAT32);
    expect(resolveOutputFormat({ bits: 20, float: false }, true)).toEqual(PCM24);
  });
});

describe('encodeWav sample formats', () => {
  it('keeps over-full-scale values in float, clamps integer output', () => {
    const ch = [Float32Array.from([1.5, -0.25])];
    const f = new DataView(encodeWav(ch, 44100, FLOAT32).buffer);
    expect(f.getFloat32(58, true)).toBe(1.5);
    expect(f.getFloat32(62, true)).toBe(-0.25);
    const i = new DataView(encodeWav(ch, 44100, PCM24).buffer);
    const s24 = (o: number) => (i.getUint8(o) | (i.getUint8(o + 1) << 8) | (i.getInt8(o + 2) << 16));
    expect(s24(44)).toBe(0x7fffff);
    expect(s24(47)).toBe(-0x200000);
  });

  it('writes unsigned 8-bit with 128 as silence', () => {
    expect(encodeWav([new Float32Array(1)], 8000, { bits: 8, float: false })[44]).toBe(128);
  });
});

describe('bit depth in estimate + pipeline', () => {
  it('estimate matches encoded size for each output format', () => {
    for (const sourceFormat of [PCM24, FLOAT32]) {
      for (const preserveBitDepth of [false, true]) {
        const est = estimateOutputBytes({
          trimmedFrames: 1000, sourceChannels: 2, sourceSampleRate: 44100, extension: 'wav', sourceFormat,
          settings: { speedMultiplier: 1, preserveStereo: true, bitrateKbps: 320, preserveBitDepth },
        });
        const format = resolveOutputFormat(sourceFormat, preserveBitDepth);
        expect(est).toBe(encodeWav([new Float32Array(1000), new Float32Array(1000)], 44100, format).length);
      }
    }
  });

  it('warns about clipping only when integer output would clip', () => {
    expect(clipWarning(2, PCM16)).toMatch(/\+6\.0 dB.*16-bit/);
    expect(clipWarning(2, FLOAT32)).toBeUndefined();
    expect(clipWarning(1, PCM16)).toBeUndefined();
  });

  it('pipeline keeps float when preserving and reports the conversion otherwise', async () => {
    const loud = Float32Array.from({ length: 4410 }, (_, i) => 1.5 * Math.sin(i / 5));
    const base = { channels: [loud], sampleRate: 44100, extension: 'wav', baseName: 'x', originalBytes: 1, sourceFormat: FLOAT32 };

    const kept = await runPipeline({ ...base, settings: { ...DEFAULT_SETTINGS, preserveBitDepth: true } });
    expect(parseSampleFormat(kept.bytes)).toEqual(FLOAT32);
    expect(kept.warning).toBeUndefined();

    const converted = await runPipeline({ ...base, channels: [loud.slice()], settings: DEFAULT_SETTINGS });
    expect(converted.stats.sourceFormat).toEqual(FLOAT32);
    expect(converted.stats.outputFormat).toEqual(PCM16);
    expect(converted.warning).toMatch(/clip at 16-bit/);
  });
});
