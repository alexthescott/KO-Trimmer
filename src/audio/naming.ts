import type { BitrateKbps } from '../app/types';
import type { OutputContainer } from './outputContainer';
import { FULL_MP3_BITRATE } from './formats';

export interface NamingInput {
  baseName: string; // filename without extension
  extension: OutputContainer;
  preserveStereo: boolean;
  bitrateKbps: BitrateKbps;
  targetSampleRate?: number; // only relevant for wav
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

  if (input.extension === 'mp3' && input.bitrateKbps < FULL_MP3_BITRATE) {
    parts.push(`${input.bitrateKbps}k`);
  } else if (
    input.extension === 'wav' &&
    input.targetSampleRate !== undefined &&
    input.targetSampleRate < CD_SAMPLE_RATE
  ) {
    parts.push(`${input.targetSampleRate}Hz`);
  }

  const filename = `${input.baseName}_${parts.join('_')}.${input.extension}`;
  return exceedsKoIILength(input.finalDurationSec) ? `_${filename}` : filename;
}
