import type { PcmAudio } from './channels';
import { ascii, dataView, iffChunks, isAiff, readExtended80 } from './iffChunks';
import { decodeInterleaved, type InterleavedFormat } from './wavDecoder';

/** AIFC compression types holding plain PCM, and the byte order each uses. */
const PCM_COMPRESSION: Record<string, { littleEndian: boolean; float: boolean }> = {
  NONE: { littleEndian: false, float: false },
  twos: { littleEndian: false, float: false },
  sowt: { littleEndian: true, float: false },
  fl32: { littleEndian: false, float: true },
  FL32: { littleEndian: false, float: true },
  fl64: { littleEndian: false, float: true },
  FL64: { littleEndian: false, float: true },
};

/**
 * Pure-JS decoder for uncompressed AIFF/AIFC — the OP-1's native sample
 * format, which Chrome's and Firefox's decodeAudioData can't read. 8–32-bit
 * integer PCM (big-endian, or little-endian `sowt`) and 32/64-bit float,
 * scaled like decodeAudioData; never resamples.
 *
 * Returns undefined for anything else (ulaw, IMA4, malformed headers) so the
 * caller can fall back to decodeAudioData.
 */
export function decodeAiff(bytes: Uint8Array): PcmAudio | undefined {
  if (!isAiff(bytes)) return undefined;
  const view = dataView(bytes);
  const isAifc = ascii(bytes, 8, 4) === 'AIFC';

  // COMM and SSND may come in either order.
  let fmt: (InterleavedFormat & { frames: number }) | undefined;
  let data: { start: number; available: number } | undefined;
  for (const { id, size, body } of iffChunks(bytes, false)) {
    if (id === 'COMM') {
      fmt = readComm(bytes, view, body, isAifc);
      if (!fmt) return undefined;
    } else if (id === 'SSND' && body + 8 <= bytes.length) {
      const start = body + 8 + view.getUint32(body, false);
      // Truncated files over-report the chunk size: decode whatever is present.
      data = { start, available: Math.max(0, Math.min(body + size, bytes.length) - start) };
    }
  }
  if (!fmt) return undefined;
  if (!data)
    return { channels: Array.from({ length: fmt.channels }, () => new Float32Array(0)), sampleRate: fmt.sampleRate };

  const blockAlign = fmt.channels * fmt.bytesPerSample;
  const frames = Math.min(fmt.frames, Math.floor(data.available / blockAlign));
  return decodeInterleaved(view, data.start, frames, fmt);
}

function readComm(
  bytes: Uint8Array,
  view: DataView,
  body: number,
  isAifc: boolean,
): (InterleavedFormat & { frames: number }) | undefined {
  if (body + 18 > bytes.length) return undefined;
  const channels = view.getUint16(body, false);
  const frames = view.getUint32(body + 2, false);
  const bits = view.getUint16(body + 6, false);
  const sampleRate = Math.round(readExtended80(view, body + 8));
  const compression = isAifc ? ascii(bytes, body + 18, 4) : 'NONE';
  const layout = PCM_COMPRESSION[compression];
  if (!layout || channels === 0 || !(sampleRate > 0)) return undefined;

  const bytesPerSample = layout.float ? (compression.endsWith('64') ? 8 : 4) : Math.ceil(bits / 8);
  if (!layout.float && (bytesPerSample < 1 || bytesPerSample > 4)) return undefined;
  return {
    channels,
    sampleRate,
    frames,
    bytesPerSample,
    float: layout.float,
    littleEndian: layout.littleEndian,
    unsigned8: false,
  };
}
