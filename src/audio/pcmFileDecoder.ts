import type { PcmAudio } from './channels';
import { decodeAiff } from './aiffDecoder';
import { decodeWav } from './wavDecoder';

/** Extensions worth trying decodePcmFile on before falling back to decodeAudioData. */
export const PCM_FILE_EXTENSIONS: ReadonlySet<string> = new Set(['wav', 'wave', 'aif', 'aiff', 'aifc']);

/** AIFF variants, which most browsers' decodeAudioData can't read at all. */
export const AIFF_EXTENSIONS: ReadonlySet<string> = new Set(['aif', 'aiff', 'aifc']);

/** Pure-JS decode of an uncompressed WAV or AIFF file (sniffed, not by name); undefined for anything else. */
export function decodePcmFile(bytes: Uint8Array): PcmAudio | undefined {
  return decodeWav(bytes) ?? decodeAiff(bytes);
}
