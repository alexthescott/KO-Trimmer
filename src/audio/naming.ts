import type { BitrateKbps } from '../app/types';

export interface NamingInput {
  baseName: string; // filename without extension
  extension: 'wav' | 'mp3' | string;
  preserveStereo: boolean;
  bitrateKbps: BitrateKbps;
  targetSampleRate?: number; // only relevant for wav
  finalDurationSec: number;
}

const KO_II_MAX_DURATION_SEC = 20;

/**
 * Output filename suffixing plus the KO-II >20s rule. The >20s check runs
 * against the FINAL processed duration (post trim + speed-up), not the
 * original input duration.
 */
export function buildOutputFilename(input: NamingInput): string {
  const parts = ['trimmed', input.preserveStereo ? 'stereo' : 'mono'];

  if (input.extension === 'mp3' && input.bitrateKbps < 320) {
    parts.push(`${input.bitrateKbps}k`);
  } else if (
    input.extension === 'wav' &&
    input.targetSampleRate !== undefined &&
    input.targetSampleRate < 44100
  ) {
    parts.push(`${input.targetSampleRate}Hz`);
  }

  let filename = `${input.baseName}_${parts.join('_')}.${input.extension}`;
  if (input.finalDurationSec > KO_II_MAX_DURATION_SEC) {
    filename = `_${filename}`;
  }
  return filename;
}
