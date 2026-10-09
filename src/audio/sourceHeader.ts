import type { SampleFormat } from './sampleFormat';
import {
  ascii,
  dataView,
  iffChunks,
  isAiff,
  isWave,
  readExtended80,
  waveFormatTag,
  WAVE_FORMAT_EXTENSIBLE,
  WAVE_FORMAT_IEEE_FLOAT,
  WAVE_FORMAT_PCM,
} from './iffChunks';

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
  if (isWave(bytes)) return parseWav(bytes);
  if (isAiff(bytes)) return parseAiff(bytes);
  const tag = ascii(bytes, 0, 4);
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
  for (const { id, size, body } of iffChunks(bytes, true)) {
    if (id !== 'fmt ') continue;
    if (body + 16 > bytes.length) return {};
    const sampleRate = view.getUint32(body + 4, true);
    const formatTag = waveFormatTag(view, body, size);
    const containerBits = view.getUint16(body + 14, true);
    const isExtensible = view.getUint16(body, true) === WAVE_FORMAT_EXTENSIBLE && body + 20 <= bytes.length;
    const bits = (isExtensible && view.getUint16(body + 18, true)) || containerBits;
    if (formatTag === WAVE_FORMAT_PCM) return { format: { bits, float: false }, sampleRate };
    if (formatTag === WAVE_FORMAT_IEEE_FLOAT) return { format: { bits, float: true }, sampleRate };
    return { sampleRate }; // compressed (ADPCM, A-law, …)
  }
  return {};
}

function parseAiff(bytes: Uint8Array): SourceInfo {
  const view = dataView(bytes);
  const isAifc = ascii(bytes, 8, 4) === 'AIFC';
  for (const { id, body } of iffChunks(bytes, false)) {
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
