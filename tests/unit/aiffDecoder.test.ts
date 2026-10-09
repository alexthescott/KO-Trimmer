import { describe, it, expect } from 'vitest';
import { decodeAiff } from '../../src/audio/aiffDecoder';
import { decodePcmFile } from '../../src/audio/pcmFileDecoder';
import { encodeWav } from '../../src/audio/wavEncoder';
import { parseSourceInfo } from '../../src/audio/sourceHeader';

interface AiffOptions {
  bits: number;
  sampleRate?: number;
  /** AIFC compression type; plain AIFF when omitted. */
  compression?: string;
  /** Put SSND before COMM (legal, if unusual). */
  ssndFirst?: boolean;
}

/** Builds an AIFF/AIFC file from interleaved integer or float sample values. */
function aiff(channels: number[][], { bits, sampleRate = 44100, compression, ssndFirst }: AiffOptions): Uint8Array {
  const frames = channels[0].length;
  const float = compression === 'fl32' || compression === 'fl64';
  const bytesPerSample = compression === 'fl64' ? 8 : float ? 4 : Math.ceil(bits / 8);
  const littleEndian = compression === 'sowt';

  const commSize = compression ? 22 + 2 : 18; // + empty pstring (count byte + pad)
  const dataSize = frames * channels.length * bytesPerSample;
  const ssndSize = 8 + dataSize;
  const total = 12 + 8 + commSize + 8 + ssndSize + (ssndSize % 2);
  const view = new DataView(new ArrayBuffer(total));
  const str = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));

  str(0, 'FORM');
  view.setUint32(4, total - 8);
  str(8, compression ? 'AIFC' : 'AIFF');

  const writeComm = (o: number) => {
    str(o, 'COMM');
    view.setUint32(o + 4, commSize);
    view.setUint16(o + 8, channels.length);
    view.setUint32(o + 10, frames);
    view.setUint16(o + 14, bits);
    // 80-bit extended: integer rates fit the top 32 mantissa bits exactly.
    const exponent = Math.floor(Math.log2(sampleRate));
    view.setUint16(o + 16, exponent + 16383);
    view.setUint32(o + 18, sampleRate * 2 ** (31 - exponent));
    view.setUint32(o + 22, 0);
    if (compression) str(o + 26, compression);
    return o + 8 + commSize;
  };
  const writeSsnd = (o: number) => {
    str(o, 'SSND');
    view.setUint32(o + 4, ssndSize);
    let p = o + 16;
    for (let i = 0; i < frames; i++) {
      for (const channel of channels) {
        const v = channel[i];
        if (compression === 'fl64') view.setFloat64(p, v);
        else if (float) view.setFloat32(p, v);
        else if (bytesPerSample === 1) view.setInt8(p, v);
        else if (bytesPerSample === 2) view.setInt16(p, v, littleEndian);
        else if (bytesPerSample === 3) {
          view.setUint8(p, (v >> 16) & 0xff);
          view.setUint8(p + 1, (v >> 8) & 0xff);
          view.setUint8(p + 2, v & 0xff);
        } else view.setInt32(p, v, littleEndian);
        p += bytesPerSample;
      }
    }
    return o + 8 + ssndSize + (ssndSize % 2);
  };

  if (ssndFirst) writeComm(writeSsnd(12));
  else writeSsnd(writeComm(12));
  return new Uint8Array(view.buffer);
}

describe('decodeAiff', () => {
  it('decodes 16-bit big-endian stereo, scaled like decodeAudioData', () => {
    const decoded = decodeAiff(
      aiff(
        [
          [0, 0x4000, -0x8000],
          [0x7fff, -0x4000, 0],
        ],
        { bits: 16 },
      ),
    )!;
    expect(decoded.sampleRate).toBe(44100);
    expect(Array.from(decoded.channels[0])).toEqual([0, 0.5, -1]);
    expect(Array.from(decoded.channels[1])).toEqual([Math.fround(0x7fff / 0x8000), -0.5, 0]);
  });

  it('decodes signed 8-bit (unlike WAV, AIFF 8-bit is two’s complement)', () => {
    const decoded = decodeAiff(aiff([[0, 64, -128]], { bits: 8 }))!;
    expect(Array.from(decoded.channels[0])).toEqual([0, 0.5, -1]);
  });

  it('decodes 24-bit and 32-bit integers', () => {
    expect(Array.from(decodeAiff(aiff([[0x400000, -0x800000]], { bits: 24 }))!.channels[0])).toEqual([0.5, -1]);
    expect(Array.from(decodeAiff(aiff([[0x40000000, -0x80000000]], { bits: 32 }))!.channels[0])).toEqual([0.5, -1]);
  });

  it('decodes AIFC sowt (little-endian) and float, keeping peaks past full scale', () => {
    expect(Array.from(decodeAiff(aiff([[0x4000, -0x4000]], { bits: 16, compression: 'sowt' }))!.channels[0])).toEqual([
      0.5, -0.5,
    ]);
    expect(Array.from(decodeAiff(aiff([[1.5, -0.25]], { bits: 32, compression: 'fl32' }))!.channels[0])).toEqual([
      1.5, -0.25,
    ]);
    expect(Array.from(decodeAiff(aiff([[0.125]], { bits: 64, compression: 'fl64' }))!.channels[0])).toEqual([0.125]);
  });

  it('reads the 80-bit extended sample rate', () => {
    for (const sampleRate of [8000, 22050, 44100, 48000, 96000]) {
      expect(decodeAiff(aiff([[0]], { bits: 16, sampleRate }))!.sampleRate).toBe(sampleRate);
    }
  });

  it('accepts SSND before COMM', () => {
    const decoded = decodeAiff(aiff([[0x4000, 0]], { bits: 16, ssndFirst: true }))!;
    expect(Array.from(decoded.channels[0])).toEqual([0.5, 0]);
  });

  it('decodes only the frames present when truncated', () => {
    const full = aiff([[1, 2, 3, 4]], { bits: 16 });
    expect(decodeAiff(full.subarray(0, full.length - 3))!.channels[0]).toHaveLength(2);
  });

  it('returns undefined for compressed AIFC and non-AIFF input', () => {
    expect(decodeAiff(aiff([[0]], { bits: 16, compression: 'ima4' }))).toBeUndefined();
    expect(decodeAiff(encodeWav([new Float32Array(4)], 44100))).toBeUndefined();
  });

  it('agrees with the header parser on rate and bit depth', () => {
    const bytes = aiff([[0, 0]], { bits: 24, sampleRate: 48000 });
    expect(parseSourceInfo(bytes)).toEqual({ format: { bits: 24, float: false }, sampleRate: 48000 });
  });
});

describe('decodePcmFile', () => {
  it('sniffs the container rather than trusting the name', () => {
    expect(decodePcmFile(encodeWav([new Float32Array([0.5])], 22050))!.sampleRate).toBe(22050);
    expect(decodePcmFile(aiff([[0x4000]], { bits: 16, sampleRate: 16000 }))!.sampleRate).toBe(16000);
    expect(decodePcmFile(new TextEncoder().encode('fLaC not really'))).toBeUndefined();
  });
});
