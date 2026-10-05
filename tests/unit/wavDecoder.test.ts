import { describe, it, expect } from 'vitest';
import { decodeWav } from '../../src/audio/wavDecoder';
import { encodeWav } from '../../src/audio/wavEncoder';
import type { SampleFormat } from '../../src/audio/sampleFormat';

const left = new Float32Array([0, 0.5, -0.5, -1, 0.25]);
const right = new Float32Array([0.1, -0.1, 0.75, 0, -0.25]);

describe('decodeWav', () => {
  it.each<[string, SampleFormat, number]>([
    ['8-bit', { bits: 8, float: false }, 1 / 0x80],
    ['16-bit', { bits: 16, float: false }, 1 / 0x8000],
    ['24-bit', { bits: 24, float: false }, 1 / 0x800000],
    ['32-bit', { bits: 32, float: false }, 1e-7],
    ['32-bit float', { bits: 32, float: true }, 0],
  ])('round-trips %s stereo through encodeWav', (_label, format, tolerance) => {
    const decoded = decodeWav(encodeWav([left, right], 44100, format))!;
    expect(decoded.sampleRate).toBe(44100);
    expect(decoded.channels).toHaveLength(2);
    for (const [out, src] of [[decoded.channels[0], left], [decoded.channels[1], right]]) {
      expect(out).toHaveLength(src.length);
      out.forEach((v, i) => expect(Math.abs(v - src[i])).toBeLessThanOrEqual(tolerance));
    }
  });

  it('scales integers like decodeAudioData (divide by 2^(bits-1))', () => {
    const decoded = decodeWav(encodeWav([new Float32Array([-1, 1])], 8000, { bits: 16, float: false }))!;
    expect(Array.from(decoded.channels[0])).toEqual([-1, Math.fround(0x7fff / 0x8000)]);
  });

  it('keeps float samples past full scale', () => {
    const decoded = decodeWav(encodeWav([new Float32Array([1.5, -2])], 48000, { bits: 32, float: true }))!;
    expect(Array.from(decoded.channels[0])).toEqual([1.5, -2]);
  });

  it('decodes only the data present when the header over-reports (truncated / RF64)', () => {
    const full = encodeWav([new Float32Array([0.5, 0.5, 0.5, 0.5])], 22050, { bits: 16, float: false });
    const decoded = decodeWav(full.subarray(0, full.length - 3))!; // last sample + 1 byte cut
    expect(decoded.channels[0]).toHaveLength(2);
  });

  it('decodes WAVE_FORMAT_EXTENSIBLE by its SubFormat, skipping chunks before fmt', () => {
    const u16 = (v: number) => [v & 0xff, (v >> 8) & 0xff];
    const u32 = (v: number) => [...u16(v & 0xffff), ...u16(v >>> 16)];
    const fourcc = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
    const fmt = [
      ...u16(0xfffe), ...u16(1), ...u32(8000), ...u32(16000), ...u16(2), ...u16(16),
      ...u16(22), ...u16(16), ...u32(4), ...u16(1), ...new Array(14).fill(0),
    ];
    const bytes = new Uint8Array([
      ...fourcc('RIFF'), ...u32(0), ...fourcc('WAVE'),
      ...fourcc('JUNK'), ...u32(3), 0, 0, 0, 0,
      ...fourcc('fmt '), ...u32(fmt.length), ...fmt,
      ...fourcc('data'), ...u32(4), ...u16(0x4000), ...u16(0xc000),
    ]);
    const decoded = decodeWav(bytes)!;
    expect(decoded.sampleRate).toBe(8000);
    expect(Array.from(decoded.channels[0])).toEqual([0.5, -0.5]);
  });

  it('rejects compressed WAV and non-WAV bytes', () => {
    const wav = encodeWav([left], 44100, { bits: 16, float: false });
    const adpcm = wav.slice();
    new DataView(adpcm.buffer).setUint16(20, 2, true); // format tag 2 = MS ADPCM
    expect(decodeWav(adpcm)).toBeUndefined();
    expect(decodeWav(new TextEncoder().encode('not a wav file at all'))).toBeUndefined();
  });
});
