import type { BitrateKbps } from '../app/types';
import { isPcmContainer, type OutputContainer } from './outputContainer';
import { FULL_MP3_BITRATE } from './formats';

export interface NamingInput {
  baseName: string; // filename without extension
  container: OutputContainer;
  /** Output file extension (outputExtensionFor), e.g. "aif" for an AIFF container. */
  extension: string;
  preserveStereo: boolean;
  bitrateKbps: BitrateKbps;
  targetSampleRate?: number; // only relevant for WAV/AIFF
  finalDurationSec: number;
}

/** Longest sample the KO II takes without the "_" prefix. */
export const KO_II_MAX_DURATION_SEC = 20;

const CD_SAMPLE_RATE = 44100;

export function exceedsKoIILength(durationSec: number): boolean {
  return durationSec > KO_II_MAX_DURATION_SEC;
}

/**
 * Output filename suffixing plus the KO-II >20s rule. The >20s check runs
 * against the FINAL processed duration (post trim + speed-up), not the
 * original input duration.
 */
export function buildOutputFilename(input: NamingInput): string {
  const parts = ['trimmed', input.preserveStereo ? 'stereo' : 'mono'];

  if (input.container === 'mp3' && input.bitrateKbps < FULL_MP3_BITRATE) {
    parts.push(`${input.bitrateKbps}k`);
  } else if (
    isPcmContainer(input.container) &&
    input.targetSampleRate !== undefined &&
    input.targetSampleRate < CD_SAMPLE_RATE
  ) {
    parts.push(`${input.targetSampleRate}Hz`);
  }

  const filename = `${input.baseName}_${parts.join('_')}.${input.extension}`;
  return exceedsKoIILength(input.finalDurationSec) ? `_${filename}` : filename;
}
