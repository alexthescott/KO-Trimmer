/**
 * Source bit depth detection + output sample-format resolution.
 *
 * decodeAudioData hands back float32 regardless of the file's stored format,
 * so the original bit depth has to be read from the container header.
 * Supported: WAV (RIFF/RF64/BW64, incl. WAVE_FORMAT_EXTENSIBLE), AIFF/AIFC,
 * FLAC. Lossy formats (mp3/m4a/ogg) have no meaningful bit depth -> undefined.
 */

export interface SampleFormat {
  bits: number;
  float: boolean;
}

export const PCM16: SampleFormat = { bits: 16, float: false };

/** How many leading bytes of a file to read for parseSampleFormat. */
export const FORMAT_PROBE_BYTES = 64 * 1024;

export function parseSampleFormat(bytes: Uint8Array): SampleFormat | undefined {
  const tag = ascii(bytes, 0, 4);
  if ((tag === 'RIFF' || tag === 'RF64' || tag === 'BW64') && ascii(bytes, 8, 4) === 'WAVE') return parseWav(bytes);
  if (tag === 'FORM' && ['AIFF', 'AIFC'].includes(ascii(bytes, 8, 4))) return parseAiff(bytes);
  if (tag === 'fLaC') return parseFlac(bytes);
  return undefined;
}

function parseWav(bytes: Uint8Array): SampleFormat | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = ascii(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 'fmt ') {
      if (body + 16 > bytes.length) return undefined;
      let formatTag = view.getUint16(body, true);
      let bits = view.getUint16(body + 14, true);
      if (formatTag === 0xfffe && size >= 40 && body + 26 <= bytes.length) {
        const validBits = view.getUint16(body + 18, true);
        if (validBits > 0) bits = validBits;
        formatTag = view.getUint16(body + 24, true); // first 2 bytes of the SubFormat GUID
      }
      if (formatTag === 1) return { bits, float: false };
      if (formatTag === 3) return { bits, float: true };
      return undefined; // compressed (ADPCM, A-law, …)
    }
    offset = body + size + (size % 2);
  }
  return undefined;
}

function parseAiff(bytes: Uint8Array): SampleFormat | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const isAifc = ascii(bytes, 8, 4) === 'AIFC';
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = ascii(bytes, offset, 4);
    const size = view.getUint32(offset + 4, false);
    const body = offset + 8;
    if (id === 'COMM') {
      if (body + 8 > bytes.length) return undefined;
      const bits = view.getUint16(body + 6, false);
      if (!isAifc) return { bits, float: false };
      if (body + 22 > bytes.length) return undefined;
      const compression = ascii(bytes, body + 18, 4);
      if (['NONE', 'sowt', 'twos', 'raw '].includes(compression)) return { bits, float: false };
      if (compression === 'fl32' || compression === 'FL32') return { bits: 32, float: true };
      if (compression === 'fl64' || compression === 'FL64') return { bits: 64, float: true };
      return undefined;
    }
    offset = body + size + (size % 2);
  }
  return undefined;
}

function parseFlac(bytes: Uint8Array): SampleFormat | undefined {
  // "fLaC" + 4-byte metadata block header, then STREAMINFO (always first).
  const info = 8;
  if (bytes.length < info + 14 || (bytes[4] & 0x7f) !== 0) return undefined;
  const bits = (((bytes[info + 12] & 0x01) << 4) | (bytes[info + 13] >> 4)) + 1;
  return { bits, float: false };
}

/**
 * Output WAV format: 16-bit PCM unless preserving, in which case the source
 * format is kept — rounded to a standard container (8/16/24/32-bit int,
 * 32-bit float; 64-bit float is narrowed to 32-bit float).
 */
export function resolveOutputFormat(source: SampleFormat | undefined, preserveBitDepth: boolean): SampleFormat {
  if (!preserveBitDepth || !source) return PCM16;
  if (source.float) return { bits: 32, float: true };
  if (source.bits <= 8) return { bits: 8, float: false };
  if (source.bits <= 16) return PCM16;
  if (source.bits <= 24) return { bits: 24, float: false };
  return { bits: 32, float: false };
}

export function sameFormat(a: SampleFormat, b: SampleFormat): boolean {
  return a.bits === b.bits && a.float === b.float;
}

/** "32-bit float", "24-bit". */
export function formatLabel(f: SampleFormat): string {
  return `${f.bits}-bit${f.float ? ' float' : ''}`;
}

/** Compact form for table tags: "32f", "24". */
export function formatShortLabel(f: SampleFormat): string {
  return `${f.bits}${f.float ? 'f' : ''}`;
}

export function peakAbs(channels: Float32Array[]): number {
  let peak = 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      const v = Math.abs(ch[i]);
      if (v > peak) peak = v;
    }
  }
  return peak;
}

/** Warning when integer output will hard-clip peaks above full scale (float sources can exceed 1.0). */
export function clipWarning(peak: number, output: SampleFormat): string | undefined {
  if (output.float || peak <= 1) return undefined;
  const overDb = 20 * Math.log10(peak);
  return `Peaks +${overDb.toFixed(1)} dB over full scale — will clip at ${formatLabel(output)}`;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  if (offset + length > bytes.length) return '';
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}
