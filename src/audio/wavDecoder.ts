import type { DecodedAudio } from './decode';

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
export function decodeWav(bytes: Uint8Array): DecodedAudio | undefined {
  const tag = ascii(bytes, 0, 4);
  if (!(tag === 'RIFF' || tag === 'RF64' || tag === 'BW64') || ascii(bytes, 8, 4) !== 'WAVE') return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let fmt: WavFmt | undefined;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = ascii(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 'fmt ') {
      fmt = readFmt(view, body, size);
      if (!fmt) return undefined;
    } else if (id === 'data') {
      if (!fmt) return undefined;
      // RF64 writes 0xFFFFFFFF here (real size is in ds64), and truncated files
      // over-report: either way, decode whatever data is actually present.
      const available = Math.min(size, bytes.length - body);
      return decodeSamples(view, body, Math.floor(available / fmt.blockAlign), fmt);
    }
    offset = body + size + (size % 2);
  }
  return undefined;
}

interface WavFmt {
  channels: number;
  sampleRate: number;
  blockAlign: number;
  /** Bytes per sample: the container size, not the (possibly smaller) valid bits. */
  bytesPerSample: number;
  float: boolean;
}

const PCM = 1;
const IEEE_FLOAT = 3;
const EXTENSIBLE = 0xfffe;

function readFmt(view: DataView, body: number, size: number): WavFmt | undefined {
  if (size < 16 || body + 16 > view.byteLength) return undefined;
  let formatTag = view.getUint16(body, true);
  const channels = view.getUint16(body + 2, true);
  const sampleRate = view.getUint32(body + 4, true);
  const blockAlign = view.getUint16(body + 12, true);
  if (formatTag === EXTENSIBLE) {
    if (size < 40 || body + 26 > view.byteLength) return undefined;
    formatTag = view.getUint16(body + 24, true); // first 2 bytes of the SubFormat GUID
  }
  if (channels === 0 || sampleRate === 0 || blockAlign % channels !== 0) return undefined;
  const bytesPerSample = blockAlign / channels;
  const float = formatTag === IEEE_FLOAT;
  if (float ? bytesPerSample !== 4 && bytesPerSample !== 8 : formatTag !== PCM || bytesPerSample < 1 || bytesPerSample > 4) {
    return undefined;
  }
  return { channels, sampleRate, blockAlign, bytesPerSample, float };
}

function decodeSamples(view: DataView, start: number, frames: number, fmt: WavFmt): DecodedAudio {
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

function sampleReader(view: DataView, fmt: WavFmt): (offset: number) => number {
  if (fmt.float) {
    return fmt.bytesPerSample === 8 ? (o) => view.getFloat64(o, true) : (o) => view.getFloat32(o, true);
  }
  switch (fmt.bytesPerSample) {
    case 1:
      return (o) => (view.getUint8(o) - 128) / 0x80;
    case 2:
      return (o) => view.getInt16(o, true) / 0x8000;
    case 3:
      return (o) => ((view.getInt8(o + 2) << 16) | (view.getUint8(o + 1) << 8) | view.getUint8(o)) / 0x800000;
    default:
      return (o) => view.getInt32(o, true) / 0x80000000;
  }
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  if (offset + length > bytes.length) return '';
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}
