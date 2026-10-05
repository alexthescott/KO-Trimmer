import { describe, it, expect } from 'vitest';
import { clipNote, resolveOutputFormat, PCM16 } from '../../src/audio/sampleFormat';
import { parseSourceInfo, id3v2Length } from '../../src/audio/sourceHeader';
import { encodeWav } from '../../src/audio/wavEncoder';
import { encodeMp3 } from '../../src/audio/mp3Encoder';
import { estimateOutputBytes } from '../../src/audio/estimate';
import { runPipeline } from '../../src/audio/pipeline';
import { DEFAULT_SETTINGS } from '../../src/settings/defaults';

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

const formatOf = (bytes: Uint8Array) => parseSourceInfo(bytes).format;

describe('parseSourceInfo', () => {
  it('reads the formats encodeWav writes', () => {
    const ch = [new Float32Array(8)];
    for (const format of [PCM16, PCM24, FLOAT32, { bits: 8, float: false }, { bits: 32, float: false }]) {
      expect(formatOf(encodeWav(ch, 44100, format))).toEqual(format);
    }
  });

  it('skips chunks before fmt and reads WAVE_FORMAT_EXTENSIBLE sub-format + valid bits', () => {
    const fmt = [
      ...u16le(0xfffe), ...u16le(2), ...u32le(48000), ...u32le(0), ...u16le(8), ...u16le(32),
      ...u16le(22), ...u16le(24), ...u32le(3), ...u16le(1), ...new Array(14).fill(0),
    ];
    const wav = bytesOf('RIFF', u32le(0), 'WAVE', 'JUNK', u32le(3), [0, 0, 0, 0], 'fmt ', u32le(40), fmt);
    expect(formatOf(wav)).toEqual(PCM24);
  });

  it('reads AIFF and AIFC float', () => {
    const comm = (extra: number[]) => [...u16be(2), ...u32be(0), ...u16be(24), ...new Array(10).fill(0), ...extra];
    expect(formatOf(bytesOf('FORM', u32be(0), 'AIFF', 'COMM', u32be(18), comm([])))).toEqual(PCM24);
    const aifc = bytesOf('FORM', u32be(0), 'AIFC', 'COMM', u32be(22), comm([...bytesOf('fl32')]));
    expect(formatOf(aifc)).toEqual(FLOAT32);
  });

  it('reads FLAC STREAMINFO bits per sample', () => {
    // 44100 Hz, 2 ch, 24 bps: bytes 10-13 = 0x0A 0xC4 0x43 0x70
    const info = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x0a, 0xc4, 0x43, 0x70, ...new Array(20).fill(0)];
    expect(formatOf(bytesOf('fLaC', [0, 0, 0, 34], info))).toEqual(PCM24);
  });

  it('returns undefined for unknown or compressed input', () => {
    expect(parseSourceInfo(bytesOf('ID3', [4, 0, 0, 0, 0, 0, 0]))).toEqual({});
    const adpcm = bytesOf('RIFF', u32le(0), 'WAVE', 'fmt ', u32le(16), [...u16le(2), ...new Array(14).fill(0)]);
    expect(formatOf(adpcm)).toBeUndefined();
  });
});

describe('parseSourceInfo sample rate', () => {
  it('reads WAV, AIFF (80-bit extended), and FLAC rates', () => {
    expect(parseSourceInfo(encodeWav([new Float32Array(4)], 22050)).sampleRate).toBe(22050);
    const comm = [...u16be(1), ...u32be(0), ...u16be(16), 0x40, 0x0e, 0xac, 0x44, 0, 0, 0, 0, 0, 0];
    expect(parseSourceInfo(bytesOf('FORM', u32be(0), 'AIFF', 'COMM', u32be(18), comm))).toEqual({
      format: PCM16, sampleRate: 44100,
    });
    const info = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x0a, 0xc4, 0x43, 0x70, ...new Array(20).fill(0)];
    expect(parseSourceInfo(bytesOf('fLaC', [0, 0, 0, 34], info)).sampleRate).toBe(44100);
  });

  it('reads MP3 frame headers past an ID3v2 tag, only for .mp3', () => {
    const id3 = bytesOf('ID3', [4, 0, 0, 0, 0, 0, 5], [1, 2, 3, 4, 5]);
    expect(id3v2Length(id3)).toBe(15);
    const mpeg1 = new Uint8Array([...id3, 0xff, 0xfb, 0x90, 0x64]);
    expect(parseSourceInfo(mpeg1, 'mp3')).toEqual({ sampleRate: 44100 });
    expect(parseSourceInfo(new Uint8Array([0xff, 0xf3, 0x58, 0xc4]), 'mp3')).toEqual({ sampleRate: 16000 });
    expect(parseSourceInfo(mpeg1, 'm4a')).toEqual({});
  });

  it('reads the rate lamejs actually encoded at', () => {
    const mp3 = encodeMp3([new Float32Array(4410)], 22050, 64);
    expect(parseSourceInfo(mp3, 'mp3').sampleRate).toBe(22050);
  });

  it('reads Ogg Vorbis rate and treats Opus as 48 kHz', () => {
    const page = (packet: number[]) => bytesOf('OggS', new Array(22).fill(0), [1, packet.length], packet);
    const vorbis = [1, ...bytesOf('vorbis'), ...u32le(0), 2, ...u32le(32000), ...new Array(8).fill(0)];
    expect(parseSourceInfo(page(vorbis))).toEqual({ sampleRate: 32000 });
    expect(parseSourceInfo(page([...bytesOf('OpusHead'), 1, 2, 0, 0, ...u32le(44100)]))).toEqual({ sampleRate: 48000 });
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

  it('notes clipping only when integer output would clip', () => {
    expect(clipNote(2, PCM16)).toMatch(/^Kept 32-bit float — peaks \+6\.0 dB.*16-bit$/);
    expect(clipNote(2, FLOAT32)).toBeUndefined();
    expect(clipNote(1, PCM16)).toBeUndefined();
  });

  it('estimates a clipping file at its 32-bit float size', () => {
    const est = estimateOutputBytes({
      trimmedFrames: 1000, sourceChannels: 1, sourceSampleRate: 44100, extension: 'wav', sourceFormat: FLOAT32, peak: 1.5,
      settings: { speedMultiplier: 1, preserveStereo: true, bitrateKbps: 320, preserveBitDepth: false },
    });
    expect(est).toBe(encodeWav([new Float32Array(1000)], 44100, FLOAT32).length);
  });

  it('pipeline keeps float when preserving, silently', async () => {
    const loud = Float32Array.from({ length: 4410 }, (_, i) => 1.5 * Math.sin(i / 5));
    const kept = await runPipeline({
      channels: [loud], sampleRate: 44100, extension: 'wav', baseName: 'x', originalBytes: 1, sourceFormat: FLOAT32,
      settings: { ...DEFAULT_SETTINGS, preserveBitDepth: true },
    });
    expect(formatOf(kept.bytes)).toEqual(FLOAT32);
    expect(kept.warning).toBeUndefined();
    expect(kept.stats.keptFloatToAvoidClipping).toBe(false);
  });

  it('pipeline keeps float instead of clipping, and says why', async () => {
    const loud = Float32Array.from({ length: 4410 }, (_, i) => 1.5 * Math.sin(i / 5));
    const result = await runPipeline({
      channels: [loud], sampleRate: 44100, extension: 'wav', baseName: 'x', originalBytes: 1, sourceFormat: FLOAT32,
      settings: DEFAULT_SETTINGS,
    });
    expect(formatOf(result.bytes)).toEqual(FLOAT32);
    expect(result.stats.outputFormat).toEqual(FLOAT32);
    expect(result.stats.keptFloatToAvoidClipping).toBe(true);
    expect(result.warning).toMatch(/^Kept 32-bit float — peaks \+3\.5 dB over full scale would clip at 16-bit$/);
  });

  it('pipeline converts float to 16-bit when nothing would clip', async () => {
    const quiet = Float32Array.from({ length: 4410 }, (_, i) => 0.5 * Math.sin(i / 5));
    const result = await runPipeline({
      channels: [quiet], sampleRate: 44100, extension: 'wav', baseName: 'x', originalBytes: 1, sourceFormat: FLOAT32,
      settings: DEFAULT_SETTINGS,
    });
    expect(result.stats.sourceFormat).toEqual(FLOAT32);
    expect(result.stats.outputFormat).toEqual(PCM16);
    expect(result.warning).toBeUndefined();
  });
});
