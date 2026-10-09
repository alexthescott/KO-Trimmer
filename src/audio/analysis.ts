import { computeAutoTrimBounds, type DetectionSettings } from './autoTrim';
import { frameCount, type PcmAudio } from './channels';
import { peakAbs } from './sampleFormat';

/** What the size estimate needs from one decoded file — a few numbers instead of the PCM. */
export interface AudioAnalysis {
  /** Channel count. */
  channels: number;
  sampleRate: number;
  frames: number;
  /** Absolute source peak — trimming only drops silence, so it stands in for the output's. */
  peak: number;
  /** Frames left after auto-trim with the given detection settings. */
  autoFrames: number;
}

export function analyseAudio(audio: PcmAudio, detection: DetectionSettings): AudioAnalysis {
  const { start, end } = computeAutoTrimBounds(audio.channels, audio.sampleRate, detection);
  return {
    channels: audio.channels.length,
    sampleRate: audio.sampleRate,
    frames: frameCount(audio.channels),
    peak: peakAbs(audio.channels),
    autoFrames: end - start,
  };
}
