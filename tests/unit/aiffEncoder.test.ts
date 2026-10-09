import { describe, it, expect } from 'vitest';
import { aiffHeaderBytes, encodeAiff } from '../../src/audio/aiffEncoder';
import { decodeAiff } from '../../src/audio/aiffDecoder';
import { parseSourceInfo } from '../../src/audio/sourceHeader';
import type { SampleFormat } from '../../src/audio/sampleFormat';

const left = new Float32Array([0, 0.5, -0.5, -1, 0.25]);
const right = new Float32Array([0.1, -0.1, 0.75, 0, -0.25]);

describe('encodeAiff', () => {
  it.each<[string, SampleFormat, number]>([
    ['8-bit', { bits: 8, float: false }, 1 / 0x80],
    ['16-bit', { bits: 16, float: false }, 1 / 0x8000],
    ['24-bit', { bits: 24, float: false }, 1 / 0x800000],
    ['32-bit', { bits: 32, float: false }, 1e-7],
    ['32-bit float (AIFC fl32)', { bits: 32, float: true }, 0],
  ])('round-trips %s stereo through decodeAiff and the header parser', (_label, format, tolerance) => {
    const bytes = encodeAiff([left, right], 48000, format);
    expect(bytes.length).toBe(aiffHeaderBytes(format) + left.length * 2 * (format.bits / 8));
    expect(parseSourceInfo(bytes)).toEqual({ format, sampleRate: 48000 });
    const decoded = decodeAiff(bytes)!;
    expect(decoded.sampleRate).toBe(48000);
    for (const [out, src] of [
      [decoded.channels[0], left],
      [decoded.channels[1], right],
    ]) {
      expect(out).toHaveLength(src.length);
      out.forEach((v, i) => expect(Math.abs(v - src[i])).toBeLessThanOrEqual(tolerance));
    }
  });

  it('pads an odd-sized sound chunk to an even length', () => {
    const bytes = encodeAiff([new Float32Array(3)], 8000, { bits: 8, float: false });
    expect(bytes.length % 2).toBe(0);
    expect(decodeAiff(bytes)!.channels[0]).toHaveLength(3);
  });

  it('writes big-endian samples', () => {
    const bytes = encodeAiff([new Float32Array([0.5])], 44100);
    expect(Array.from(bytes.subarray(aiffHeaderBytes({ bits: 16, float: false })))).toEqual([0x40, 0x00]);
  });
});
