import type { PcmAudio } from './channels';
import { dataView, iffChunks, isWave, waveFormatTag, WAVE_FORMAT_IEEE_FLOAT, WAVE_FORMAT_PCM } from './iffChunks';

/**
 * Pure-JS decoder for uncompressed WAV (RIFF/RF64/BW64): 8/16/24/32-bit
 * integer PCM and 32/64-bit float, incl. WAVE_FORMAT_EXTENSIBLE. Unlike
 * decodeAudioData it runs in a worker, needs no AudioContext, and never
 * resamples — the header's rate is returned as-is.
 *
 * Scaling matches decodeAudioData so outputs don't change with the decode
 * path: integers divide by 2^(containerBits-1) (8-bit is unsigned, centred
 * on 128), floats pass through unclamped (over-full-scale peaks survive).
 *
 * Returns undefined for anything else (ADPCM, A-law, malformed headers) so
 * the caller can fall back to decodeAudioData.
 */
export function decodeWav(bytes: Uint8Array): PcmAudio | undefined {
  if (!isWave(bytes)) return undefined;
  const view = dataView(bytes);

  let fmt: WavFmt | undefined;
  for (const { id, size, body } of iffChunks(bytes, true)) {
    if (id === 'fmt ') {
      fmt = readFmt(view, body, size);
      if (!fmt) return undefined;
    } else if (id === 'data') {
      if (!fmt) return undefined;
      // RF64 writes 0xFFFFFFFF here (real size is in ds64), and truncated files
      // over-report: either way, decode whatever data is actually present.
      const available = Math.min(size, bytes.length - body);
      return decodeInterleaved(view, body, Math.floor(available / fmt.blockAlign), fmt);
    }
  }
  return undefined;
}

/** Layout of interleaved PCM samples, as described by a WAV `fmt ` or AIFF `COMM` chunk. */
export interface InterleavedFormat {
  channels: number;
  sampleRate: number;
  /** Bytes per sample: the container size, not the (possibly smaller) valid bits. */
  bytesPerSample: number;
  float: boolean;
  littleEndian: boolean;
  /** 8-bit samples are offset binary (WAV) rather than two's complement (AIFF). */
  unsigned8: boolean;
}

interface WavFmt extends InterleavedFormat {
  blockAlign: number;
}

function readFmt(view: DataView, body: number, size: number): WavFmt | undefined {
  if (size < 16 || body + 16 > view.byteLength) return undefined;
  const formatTag = waveFormatTag(view, body, size);
  const channels = view.getUint16(body + 2, true);
  const sampleRate = view.getUint32(body + 4, true);
  const blockAlign = view.getUint16(body + 12, true);
  if (channels === 0 || sampleRate === 0 || blockAlign % channels !== 0) return undefined;
  const bytesPerSample = blockAlign / channels;
  const float = formatTag === WAVE_FORMAT_IEEE_FLOAT;
  if (float ? bytesPerSample !== 4 && bytesPerSample !== 8 : formatTag !== WAVE_FORMAT_PCM || bytesPerSample < 1 || bytesPerSample > 4) {
    return undefined;
  }
  return { channels, sampleRate, blockAlign, bytesPerSample, float, littleEndian: true, unsigned8: true };
}

/**
 * Deinterleaves `frames` frames starting at byte `start` into planar float
 * channels, scaled like decodeAudioData: integers divide by
 * 2^(containerBits-1), floats pass through unclamped.
 */
export function decodeInterleaved(view: DataView, start: number, frames: number, fmt: InterleavedFormat): PcmAudio {
  const read = sampleReader(view, fmt);
  const channels = Array.from({ length: fmt.channels }, () => new Float32Array(frames));
  let offset = start;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < fmt.channels; c++) {
      channels[c][i] = read(offset);
      offset += fmt.bytesPerSample;
    }
  }
  return { channels, sampleRate: fmt.sampleRate };
}

function sampleReader(view: DataView, fmt: InterleavedFormat): (offset: number) => number {
  const le = fmt.littleEndian;
  if (fmt.float) {
    return fmt.bytesPerSample === 8 ? (o) => view.getFloat64(o, le) : (o) => view.getFloat32(o, le);
  }
  switch (fmt.bytesPerSample) {
    case 1:
      return fmt.unsigned8 ? (o) => (view.getUint8(o) - 128) / 0x80 : (o) => view.getInt8(o) / 0x80;
    case 2:
      return (o) => view.getInt16(o, le) / 0x8000;
    case 3:
      return le
        ? (o) => ((view.getInt8(o + 2) << 16) | (view.getUint8(o + 1) << 8) | view.getUint8(o)) / 0x800000
        : (o) => ((view.getInt8(o) << 16) | (view.getUint8(o + 1) << 8) | view.getUint8(o + 2)) / 0x800000;
    default:
      return (o) => view.getInt32(o, le) / 0x80000000;
  }
}
