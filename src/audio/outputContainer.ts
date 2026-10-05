import { resolveOutputFormat, type SampleFormat } from './sampleFormat';

export type OutputContainer = 'wav' | 'mp3';

/**
 * MP3 inputs stay MP3; everything else is written as WAV — there's no
 * browser encoder for flac/aiff/m4a/ogg, and every target sampler reads WAV.
 */
export function outputContainerFor(sourceExtension: string): OutputContainer {
  return sourceExtension === 'mp3' ? 'mp3' : 'wav';
}

/** Sample format written for this container; undefined for MP3, which has no PCM bit depth. */
export function outputSampleFormat(
  container: OutputContainer,
  source: SampleFormat | undefined,
  preserveBitDepth: boolean,
): SampleFormat | undefined {
  return container === 'wav' ? resolveOutputFormat(source, preserveBitDepth) : undefined;
}
