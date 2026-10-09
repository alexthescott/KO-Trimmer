import { clipNote, FLOAT32, resolveOutputFormat, type SampleFormat } from './sampleFormat';

export type OutputContainer = 'wav' | 'aiff' | 'mp3';

const AIFF_SOURCE_EXTENSIONS: ReadonlySet<string> = new Set(['aif', 'aiff', 'aifc']);

/**
 * MP3 stays MP3 and AIFF stays AIFF (the OP-1's format); everything else is
 * written as WAV — there's no browser encoder for flac/m4a/ogg, and every
 * target sampler reads WAV.
 */
export function outputContainerFor(sourceExtension: string): OutputContainer {
  if (sourceExtension === 'mp3') return 'mp3';
  return AIFF_SOURCE_EXTENSIONS.has(sourceExtension) ? 'aiff' : 'wav';
}

/** Uncompressed output, where sample rate, bit depth and clipping apply. */
export function isPcmContainer(container: OutputContainer): boolean {
  return container !== 'mp3';
}

/**
 * The output file's extension: the source's own for .aif/.aiff (so a kit
 * keeps its naming, and Overwrite can replace it), .aif for .aifc (the
 * output is plain AIFF unless float), otherwise the container's.
 */
export function outputExtensionFor(sourceExtension: string): string {
  const container = outputContainerFor(sourceExtension);
  if (container !== 'aiff') return container;
  return sourceExtension === 'aiff' ? 'aiff' : 'aif';
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
  return isPcmContainer(container) ? chooseWavFormat(source, preserveBitDepth, peak) : {};
}

/** chooseOutputFormat for WAV, where there is always a sample format. */
export function chooseWavFormat(source: SampleFormat | undefined, preserveBitDepth: boolean, peak?: number): WavFormat {
  const intended = resolveOutputFormat(source, preserveBitDepth);
  const note = peak === undefined ? undefined : clipNote(peak, intended);
  return note ? { format: FLOAT32, clipNote: note } : { format: intended };
}
