import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { encodeWav } from '../../src/audio/wavEncoder';
import { encodeMp3 } from '../../src/audio/mp3Encoder';

/** `pad` s of silence, `tone` s of a 440 Hz sine at half scale, `pad` s of silence. */
export function paddedTone(sampleRate: number, pad = 0.5, tone = 0.5): Float32Array {
  const padFrames = Math.round(pad * sampleRate);
  const toneFrames = Math.round(tone * sampleRate);
  const out = new Float32Array(2 * padFrames + toneFrames);
  for (let i = 0; i < toneFrames; i++) out[padFrames + i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / sampleRate);
  return out;
}

/** Minimal big-endian 16-bit AIFF (what the OP-1 writes). */
export function encodeAiff16(channels: Float32Array[], sampleRate: number): Uint8Array {
  const frames = channels[0].length;
  const dataSize = frames * channels.length * 2;
  const view = new DataView(new ArrayBuffer(12 + 26 + 16 + dataSize));
  const str = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'FORM');
  view.setUint32(4, view.byteLength - 8);
  str(8, 'AIFF');
  str(12, 'COMM');
  view.setUint32(16, 18);
  view.setUint16(20, channels.length);
  view.setUint32(22, frames);
  view.setUint16(26, 16);
  const exponent = Math.floor(Math.log2(sampleRate));
  view.setUint16(28, exponent + 16383);
  view.setUint32(30, sampleRate * 2 ** (31 - exponent));
  str(38, 'SSND');
  view.setUint32(42, 8 + dataSize);
  let o = 54;
  for (let i = 0; i < frames; i++) {
    for (const channel of channels) {
      view.setInt16(o, Math.round(Math.max(-1, Math.min(1, channel[i])) * 0x7fff));
      o += 2;
    }
  }
  return new Uint8Array(view.buffer);
}

export interface Fixture {
  /** Path inside the dropped folder, e.g. "kit/sub/snare.aif". */
  path: string;
  bytes: Uint8Array;
  /** Frames before trimming, at the file's own rate. */
  frames: number;
}

/** A small kit folder: stereo 16-bit WAV, mono AIFF at 48 kHz, and a 128 kbps MP3 — all silence-padded. */
export function kitFixtures(): Fixture[] {
  const wav = paddedTone(44100);
  const aif = paddedTone(48000);
  const mp3 = paddedTone(44100);
  return [
    { path: 'kit/kick.wav', bytes: encodeWav([wav, wav], 44100), frames: wav.length },
    { path: 'kit/sub/snare.aif', bytes: encodeAiff16([aif], 48000), frames: aif.length },
    { path: 'kit/loop.mp3', bytes: encodeMp3([mp3], 44100, 128), frames: mp3.length },
  ];
}

/** Writes the fixtures under `root`, returning the kit folder's path. */
export function writeKit(root: string): string {
  for (const { path, bytes } of kitFixtures()) {
    const file = join(root, path);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, bytes);
  }
  return join(root, 'kit');
}
