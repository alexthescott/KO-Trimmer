import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FileEntry } from '../../src/app/types';
import { encodeWav } from '../../src/audio/wavEncoder';

const decodeAudioFile = vi.fn();
vi.mock('../../src/audio/decode', () => ({ decodeAudioFile: (...args: unknown[]) => decodeAudioFile(...args) }));

const { decodeEntry } = await import('../../src/app/decodedCache');

const entry = (name: string, bytes: Uint8Array): FileEntry => ({
  id: name,
  name,
  relativePath: name,
  size: bytes.length,
  file: new File([bytes as Uint8Array<ArrayBuffer>], name),
  status: 'queued',
});

describe('decodeEntry', () => {
  beforeEach(() => {
    decodeAudioFile.mockReset();
  });

  it('decodes AIFF in pure JS without touching decodeAudioData', async () => {
    // A minimal AIFF: COMM (mono, 2 frames, 16-bit, 8 kHz) + SSND.
    const aiff = new Uint8Array([
      ...[0x46, 0x4f, 0x52, 0x4d, 0, 0, 0, 46, 0x41, 0x49, 0x46, 0x46],
      ...[0x43, 0x4f, 0x4d, 0x4d, 0, 0, 0, 18, 0, 1, 0, 0, 0, 2, 0, 16, 0x40, 0x0b, 0xfa, 0, 0, 0, 0, 0, 0, 0],
      ...[0x53, 0x53, 0x4e, 0x44, 0, 0, 0, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0x40, 0x00, 0xc0, 0x00],
    ]);
    const audio = await decodeEntry(entry('kick.aif', aiff));
    expect(audio.sampleRate).toBe(8000);
    expect(Array.from(audio.channels[0])).toEqual([0.5, -0.5]);
    expect(decodeAudioFile).not.toHaveBeenCalled();
  });

  it('leaves WAV to decodeAudioData', async () => {
    decodeAudioFile.mockResolvedValue({ channels: [], sampleRate: 44100 });
    await decodeEntry(entry('a.wav', encodeWav([new Float32Array(2)], 44100)));
    expect(decodeAudioFile).toHaveBeenCalledTimes(1);
  });

  it('explains a decode failure, naming the format and keeping the browser’s reason', async () => {
    const browserError = new DOMException('Unable to decode audio data', 'EncodingError');
    decodeAudioFile.mockRejectedValue(browserError);
    const failure: Error = await decodeEntry(entry('pad.ogg', new Uint8Array([1, 2, 3]))).catch((err) => err);
    expect(failure.message).toMatch(/couldn’t decode this \.ogg file.*Unable to decode audio data/);
    expect(failure.cause).toBe(browserError);
  });
});
