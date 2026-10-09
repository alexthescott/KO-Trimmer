import { renderAudible, type RenderInput } from './pipeline';
import { encodeMp3 } from './mp3Encoder';
import { frameCount, type PcmAudio } from './channels';
import { FULL_MP3_BITRATE } from './formats';

/** What crosses to the preview worker: RenderInput minus its (uncloneable) callback. */
export type PreviewRequestInput = Omit<RenderInput, 'onStage'>;

/**
 * The rendered preview: PCM, or for MP3 below full bitrate the real encoder's
 * bytes, so "Play Processed" carries the batch output's artifacts (decoded
 * back on the main thread — decodeAudioData isn't available in workers).
 */
export type PreviewResult = { kind: 'pcm'; audio: PcmAudio } | { kind: 'mp3'; bytes: Uint8Array; sampleRate: number };

/** Worker-side render of the editor's processed preview. */
export async function renderPreviewJob(input: PreviewRequestInput): Promise<PreviewResult> {
  const audio = await renderAudible(input);
  const { bitrateKbps } = input.settings;
  if (input.container !== 'mp3' || bitrateKbps >= FULL_MP3_BITRATE || frameCount(audio.channels) === 0) {
    return { kind: 'pcm', audio };
  }
  try {
    return {
      kind: 'mp3',
      bytes: encodeMp3(audio.channels, audio.sampleRate, bitrateKbps),
      sampleRate: audio.sampleRate,
    };
  } catch {
    // Fall back to the un-encoded preview rather than showing nothing.
    return { kind: 'pcm', audio };
  }
}
