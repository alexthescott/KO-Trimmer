import { clipNote, FLOAT32, resolveOutputFormat, type SampleFormat } from './sampleFormat';

export type OutputContainer = 'wav' | 'mp3';

/**
 * MP3 inputs stay MP3; everything else is written as WAV — there's no
 * browser encoder for flac/aiff/m4a/ogg, and every target sampler reads WAV.
 */
export function outputContainerFor(sourceExtension: string): OutputContainer {
  return sourceExtension === 'mp3' ? 'mp3' : 'wav';
}

export interface WavFormat {
  format: SampleFormat;
  /** Set when integer output would have clipped, so 32-bit float is written instead. */
  clipNote?: string;
}

export interface OutputFormat {
  /** Undefined for MP3, which has no PCM bit depth. */
  format?: SampleFormat;
  /** Set when integer output would have clipped, so 32-bit float is written instead. */
  clipNote?: string;
}

/**
 * Sample format written for this container: the bit-depth policy, except
 * that WAV output which would clip (`peak` > 1) stays 32-bit float rather
 * than being flattened. `peak` undefined = not known yet.
 */
export function chooseOutputFormat(
  container: OutputContainer,
  source: SampleFormat | undefined,
  preserveBitDepth: boolean,
  peak?: number,
): OutputFormat {
  return container === 'mp3' ? {} : chooseWavFormat(source, preserveBitDepth, peak);
}

/** chooseOutputFormat for WAV, where there is always a sample format. */
export function chooseWavFormat(source: SampleFormat | undefined, preserveBitDepth: boolean, peak?: number): WavFormat {
  const intended = resolveOutputFormat(source, preserveBitDepth);
  const note = peak === undefined ? undefined : clipNote(peak, intended);
  return note ? { format: FLOAT32, clipNote: note } : { format: intended };
}
