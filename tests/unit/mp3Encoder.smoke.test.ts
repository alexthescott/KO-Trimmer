import { describe, it, expect } from 'vitest';
import { encodeMp3 } from '../../src/audio/mp3Encoder';
import { tone } from '../fixtures/synthesize';

describe('encodeMp3 (lamejs smoke test)', () => {
  it('produces a non-trivial, well-formed MP3 byte stream from synthetic PCM', () => {
    const sampleRate = 44100;
    const channel = tone(sampleRate / 2, 0.5, 440, sampleRate); // 0.5s of a 440Hz tone
    const bytes = encodeMp3([channel, channel], sampleRate, 128);

    expect(bytes.length).toBeGreaterThan(1000);

    // MP3 frame sync: 0xFF followed by a byte with the top 3 bits set (0xE0 mask).
    let foundFrameSync = false;
    for (let i = 0; i < bytes.length - 1; i++) {
      if (bytes[i] === 0xff && (bytes[i + 1] & 0xe0) === 0xe0) {
        foundFrameSync = true;
        break;
      }
    }
    expect(foundFrameSync).toBe(true);
  });

  it('throws AbortError instead of returning a truncated file when cancelled', () => {
    const sampleRate = 44100;
    const channel = tone(sampleRate * 2, 0.5, 440, sampleRate); // 2s, many chunks
    let calls = 0;
    const encode = () =>
      encodeMp3([channel], sampleRate, 128, () => {
        calls++;
        return calls > 1; // cancel after the first check
      });
    expect(encode).toThrow(expect.objectContaining({ name: 'AbortError' }));
    expect(calls).toBe(2);
  });
});
