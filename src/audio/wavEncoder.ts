import { PCM16, type SampleFormat } from './sampleFormat';

/**
 * Header size for a WAV written by encodeWav: 44 bytes for integer PCM;
 * float adds an 18-byte fmt chunk (cbSize) and the `fact` chunk non-PCM
 * formats require.
 */
export function wavHeaderBytes(format: SampleFormat): number {
  return format.float ? 44 + 2 + 12 : 44;
}

/** Hand-written RIFF WAV writer (8/16/24/32-bit PCM or 32-bit float) — no library dependency needed. */
export function encodeWav(channels: Float32Array[], sampleRate: number, format: SampleFormat = PCM16): Uint8Array {
  const numChannels = channels.length;
  const numFrames = channels[0]?.length ?? 0;
  const bytesPerSample = format.bits / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const headerSize = wavHeaderBytes(format);
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  const fmtSize = format.float ? 18 : 16;
  writeString(view, 0, 'RIFF');
  view.setUint32(4, headerSize - 8 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, fmtSize, true);
  view.setUint16(20, format.float ? 3 : 1, true); // IEEE float : PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, format.bits, true); // bits per sample
  let offset = 36;
  if (format.float) {
    view.setUint16(36, 0, true); // cbSize
    writeString(view, 38, 'fact');
    view.setUint32(42, 4, true);
    view.setUint32(46, numFrames, true);
    offset = 50;
  }
  writeString(view, offset, 'data');
  view.setUint32(offset + 4, dataSize, true);
  offset += 8;

  const writeSample = sampleWriter(view, format);
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      writeSample(offset, channels[c][i]);
      offset += bytesPerSample;
    }
  }

  return new Uint8Array(buffer);
}

function sampleWriter(view: DataView, format: SampleFormat): (offset: number, sample: number) => void {
  // Float output keeps over-full-scale values; integer output clamps to [-1, 1].
  if (format.float) return (offset, s) => view.setFloat32(offset, s, true);
  const toInt = (s: number, negScale: number, posScale: number) => {
    const c = Math.max(-1, Math.min(1, s));
    return Math.round(c < 0 ? c * negScale : c * posScale);
  };
  switch (format.bits) {
    case 8: // unsigned, 128 = silence
      return (offset, s) => view.setUint8(offset, toInt(s, 0x80, 0x7f) + 128);
    case 24:
      return (offset, s) => {
        const v = toInt(s, 0x800000, 0x7fffff);
        view.setUint8(offset, v & 0xff);
        view.setUint8(offset + 1, (v >> 8) & 0xff);
        view.setUint8(offset + 2, (v >> 16) & 0xff);
      };
    case 32:
      return (offset, s) => view.setInt32(offset, toInt(s, 0x80000000, 0x7fffffff), true);
    default:
      return (offset, s) => view.setInt16(offset, toInt(s, 0x8000, 0x7fff), true);
  }
}

function writeString(view: DataView, offset: number, value: string): void {
  for (let i = 0; i < value.length; i++) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}
