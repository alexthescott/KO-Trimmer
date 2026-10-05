import type { SampleFormat } from './sampleFormat';

/**
 * Source header parsing: bit depth + native sample rate.
 *
 * decodeAudioData hands back float32 resampled to the context's rate, so the
 * file's real bit depth and sample rate have to be read from its header.
 * Bit depth: WAV (RIFF/RF64/BW64, incl. WAVE_FORMAT_EXTENSIBLE), AIFF/AIFC,
 * FLAC. Sample rate: those plus MP3 and Ogg Vorbis/Opus. M4A is left
 * undefined on purpose — its sample entry under-reports HE-AAC (SBR) rates
 * and is often at the end of the file.
 */

export interface SourceInfo {
  /** Undefined for lossy/compressed formats with no meaningful bit depth. */
  format?: SampleFormat;
  sampleRate?: number;
}

/** How many leading bytes of a file to read for parseSourceInfo. */
export const FORMAT_PROBE_BYTES = 64 * 1024;

/** `extension` gates MP3 frame-sync scanning, which could false-match inside other binary formats. */
export function parseSourceInfo(bytes: Uint8Array, extension = ''): SourceInfo {
  const tag = ascii(bytes, 0, 4);
  if ((tag === 'RIFF' || tag === 'RF64' || tag === 'BW64') && ascii(bytes, 8, 4) === 'WAVE') return parseWav(bytes);
  if (tag === 'FORM' && ['AIFF', 'AIFC'].includes(ascii(bytes, 8, 4))) return parseAiff(bytes);
  if (tag === 'fLaC') return parseFlac(bytes);
  if (tag === 'OggS') return parseOgg(bytes);
  return extension === 'mp3' ? parseMp3(bytes) : {};
}

/** Total ID3v2 tag length (header + body + footer), or 0 when there is none. */
export function id3v2Length(bytes: Uint8Array): number {
  if (ascii(bytes, 0, 3) !== 'ID3' || bytes.length < 10) return 0;
  const size = ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f);
  return 10 + size + (bytes[5] & 0x10 ? 10 : 0);
}

function parseWav(bytes: Uint8Array): SourceInfo {
  const view = dataView(bytes);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = ascii(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 'fmt ') {
      if (body + 16 > bytes.length) return {};
      let formatTag = view.getUint16(body, true);
      const sampleRate = view.getUint32(body + 4, true);
      let bits = view.getUint16(body + 14, true);
      if (formatTag === 0xfffe && size >= 40 && body + 26 <= bytes.length) {
        const validBits = view.getUint16(body + 18, true);
        if (validBits > 0) bits = validBits;
        formatTag = view.getUint16(body + 24, true); // first 2 bytes of the SubFormat GUID
      }
      if (formatTag === 1) return { format: { bits, float: false }, sampleRate };
      if (formatTag === 3) return { format: { bits, float: true }, sampleRate };
      return { sampleRate }; // compressed (ADPCM, A-law, …)
    }
    offset = body + size + (size % 2);
  }
  return {};
}

function parseAiff(bytes: Uint8Array): SourceInfo {
  const view = dataView(bytes);
  const isAifc = ascii(bytes, 8, 4) === 'AIFC';
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = ascii(bytes, offset, 4);
    const size = view.getUint32(offset + 4, false);
    const body = offset + 8;
    if (id === 'COMM') {
      if (body + 18 > bytes.length) return {};
      const bits = view.getUint16(body + 6, false);
      const sampleRate = Math.round(readExtended80(view, body + 8));
      if (!isAifc) return { format: { bits, float: false }, sampleRate };
      if (body + 22 > bytes.length) return { sampleRate };
      const compression = ascii(bytes, body + 18, 4);
      if (['NONE', 'sowt', 'twos', 'raw '].includes(compression)) return { format: { bits, float: false }, sampleRate };
      if (compression === 'fl32' || compression === 'FL32') return { format: { bits: 32, float: true }, sampleRate };
      if (compression === 'fl64' || compression === 'FL64') return { format: { bits: 64, float: true }, sampleRate };
      return { sampleRate };
    }
    offset = body + size + (size % 2);
  }
  return {};
}

function parseFlac(bytes: Uint8Array): SourceInfo {
  // "fLaC" + 4-byte metadata block header, then STREAMINFO (always first).
  const info = 8;
  if (bytes.length < info + 14 || (bytes[4] & 0x7f) !== 0) return {};
  const sampleRate = (bytes[info + 10] << 12) | (bytes[info + 11] << 4) | (bytes[info + 12] >> 4);
  const bits = (((bytes[info + 12] & 0x01) << 4) | (bytes[info + 13] >> 4)) + 1;
  return { format: { bits, float: false }, sampleRate };
}

function parseOgg(bytes: Uint8Array): SourceInfo {
  if (bytes.length < 27) return {};
  const packet = 27 + bytes[26]; // page header + segment table
  if (bytes[packet] === 1 && ascii(bytes, packet + 1, 6) === 'vorbis' && packet + 16 <= bytes.length) {
    return { sampleRate: dataView(bytes).getUint32(packet + 12, true) };
  }
  // Opus always decodes at 48 kHz regardless of the original input rate.
  if (ascii(bytes, packet, 8) === 'OpusHead') return { sampleRate: 48000 };
  return {};
}

const MP3_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000], // MPEG-1
  2: [22050, 24000, 16000], // MPEG-2
  0: [11025, 12000, 8000], // MPEG-2.5
};

/** First valid MPEG audio frame header after any ID3v2 tag. */
function parseMp3(bytes: Uint8Array): SourceInfo {
  for (let i = id3v2Length(bytes); i + 4 <= bytes.length; i++) {
    if (bytes[i] !== 0xff || (bytes[i + 1] & 0xe0) !== 0xe0) continue;
    const version = (bytes[i + 1] >> 3) & 0x03;
    const layer = (bytes[i + 1] >> 1) & 0x03;
    const bitrateIndex = bytes[i + 2] >> 4;
    const rateIndex = (bytes[i + 2] >> 2) & 0x03;
    if (version === 1 || layer === 0 || bitrateIndex === 0x0f || rateIndex === 3) continue;
    return { sampleRate: MP3_RATES[version][rateIndex] };
  }
  return {};
}

/** IEEE 754 80-bit extended (AIFF sample rate). */
function readExtended80(view: DataView, offset: number): number {
  const exponent = (view.getUint16(offset, false) & 0x7fff) - 16383;
  const hi = view.getUint32(offset + 2, false);
  const lo = view.getUint32(offset + 6, false);
  return hi * 2 ** (exponent - 31) + lo * 2 ** (exponent - 63);
}

function dataView(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  if (offset + length > bytes.length) return '';
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}
