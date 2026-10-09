/**
 * Shared byte-level helpers for the IFF-family containers (RIFF/RF64/BW64
 * WAV, little-endian; AIFF/AIFC, big-endian): header tags, the chunk walk,
 * and WAV format tags. Used by header probing, the WAV/AIFF decoders and
 * the WAV encoder.
 */

/** WAV `fmt ` format tags. */
export const WAVE_FORMAT_PCM = 1;
export const WAVE_FORMAT_IEEE_FLOAT = 3;
export const WAVE_FORMAT_EXTENSIBLE = 0xfffe;

export interface IffChunk {
  id: string;
  /** Declared body size — may over-report in truncated or RF64 files. */
  size: number;
  /** Offset of the chunk body. */
  body: number;
}

/** Four-char-code (or other ASCII run) at `offset`; '' when it runs past the end. */
export function ascii(bytes: Uint8Array, offset: number, length: number): string {
  if (offset + length > bytes.length) return '';
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

export function dataView(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/** RIFF, RF64 or BW64 container holding WAVE data. */
export function isWave(bytes: Uint8Array): boolean {
  const tag = ascii(bytes, 0, 4);
  return (tag === 'RIFF' || tag === 'RF64' || tag === 'BW64') && ascii(bytes, 8, 4) === 'WAVE';
}

/** FORM container holding AIFF or AIFC data. */
export function isAiff(bytes: Uint8Array): boolean {
  return ascii(bytes, 0, 4) === 'FORM' && ['AIFF', 'AIFC'].includes(ascii(bytes, 8, 4));
}

/** Top-level chunks after the 12-byte container header, padded to even sizes. */
export function* iffChunks(bytes: Uint8Array, littleEndian: boolean): Generator<IffChunk> {
  const view = dataView(bytes);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const size = view.getUint32(offset + 4, littleEndian);
    const body = offset + 8;
    yield { id: ascii(bytes, offset, 4), size, body };
    offset = body + size + (size % 2);
  }
}

/**
 * The `fmt ` chunk's format tag, looking through WAVE_FORMAT_EXTENSIBLE to
 * its SubFormat GUID. A truncated EXTENSIBLE chunk stays EXTENSIBLE, which
 * callers treat as unsupported.
 */
export function waveFormatTag(view: DataView, body: number, size: number): number {
  const tag = view.getUint16(body, true);
  if (tag !== WAVE_FORMAT_EXTENSIBLE || size < 40 || body + 26 > view.byteLength) return tag;
  return view.getUint16(body + 24, true); // first 2 bytes of the SubFormat GUID
}

/** IEEE 754 80-bit extended (AIFF sample rate). */
export function readExtended80(view: DataView, offset: number): number {
  const exponent = (view.getUint16(offset, false) & 0x7fff) - 16383;
  const hi = view.getUint32(offset + 2, false);
  const lo = view.getUint32(offset + 6, false);
  return hi * 2 ** (exponent - 31) + lo * 2 ** (exponent - 63);
}
