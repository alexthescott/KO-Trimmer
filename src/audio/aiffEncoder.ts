import { PCM16, type SampleFormat } from './sampleFormat';
import { frameCount } from './channels';
import { writeExtended80 } from './iffChunks';
import { writeInterleaved, writeString } from './wavEncoder';

/** AIFC version timestamp the spec requires in FVER. */
const AIFC_VERSION_1 = 0xa2805140;

/**
 * Header size for a file written by encodeAiff: AIFF (FORM + COMM + SSND
 * headers) for integer PCM; float needs AIFC, which adds FVER and the
 * compression type + empty name in COMM.
 */
export function aiffHeaderBytes(format: SampleFormat): number {
  return format.float ? 12 + 12 + 32 + 16 : 12 + 26 + 16;
}

/**
 * Hand-written AIFF writer — big-endian, signed 8/16/24/32-bit PCM, or AIFC
 * `fl32` for 32-bit float (plain AIFF has no float). Lets AIFF sources
 * (the OP-1's format) stay AIFF instead of becoming WAV.
 */
export function encodeAiff(channels: Float32Array[], sampleRate: number, format: SampleFormat = PCM16): Uint8Array {
  const numFrames = frameCount(channels);
  const dataSize = numFrames * channels.length * (format.bits / 8);
  const pad = dataSize % 2;
  const headerSize = aiffHeaderBytes(format);
  const view = new DataView(new ArrayBuffer(headerSize + dataSize + pad));

  writeString(view, 0, 'FORM');
  view.setUint32(4, view.byteLength - 8, false);
  writeString(view, 8, format.float ? 'AIFC' : 'AIFF');
  let offset = 12;
  if (format.float) {
    writeString(view, offset, 'FVER');
    view.setUint32(offset + 4, 4, false);
    view.setUint32(offset + 8, AIFC_VERSION_1, false);
    offset += 12;
  }

  writeString(view, offset, 'COMM');
  view.setUint32(offset + 4, format.float ? 24 : 18, false);
  view.setUint16(offset + 8, channels.length, false);
  view.setUint32(offset + 10, numFrames, false);
  view.setUint16(offset + 14, format.bits, false);
  writeExtended80(view, offset + 16, sampleRate);
  offset += 26;
  if (format.float) {
    writeString(view, offset, 'fl32');
    offset += 6; // + empty Pascal-string name (length byte) and its pad byte
  }

  writeString(view, offset, 'SSND');
  view.setUint32(offset + 4, 8 + dataSize, false);
  // offset and blockSize stay 0
  writeInterleaved(view, offset + 16, channels, format, { littleEndian: false, unsigned8: false });
  return new Uint8Array(view.buffer);
}
