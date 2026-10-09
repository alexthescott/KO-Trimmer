import type { RenderInput } from '../../../audio/pipeline';
import { renderPreview } from '../../../audio/preview';
import { peakAbs } from '../../../audio/sampleFormat';
import type { PcmAudio } from '../../../audio/channels';
import { waveformOf, type Waveform } from './draw';

const PREVIEW_DEBOUNCE_MS = 150;

export interface ProcessedPreview extends PcmAudio {
  wave: Waveform;
  /** Absolute peak, for the clip warning. */
  peak: number;
}

/**
 * Debounced render of the editor's "Play Processed" preview, in a worker. MP3
 * output below full bitrate is round-tripped through the real encoder so its
 * artifacts are audible. A render superseded by a newer one is dropped.
 */
export class PreviewRenderer {
  private timer?: number;
  private latest?: Promise<void>;
  private token = 0;

  constructor(
    private readonly currentInput: () => RenderInput | undefined,
    private readonly onRendered: (preview: ProcessedPreview) => void,
  ) {}

  schedule(delay = PREVIEW_DEBOUNCE_MS): void {
    this.cancel();
    this.timer = window.setTimeout(() => {
      this.timer = undefined;
      this.latest = this.render();
    }, delay);
  }

  /** Runs any pending render now and waits for the newest one. */
  async flush(): Promise<void> {
    if (this.timer !== undefined) {
      this.cancel();
      this.latest = this.render();
    }
    await this.latest;
  }

  cancel(): void {
    window.clearTimeout(this.timer);
    this.timer = undefined;
  }

  private async render(): Promise<void> {
    const input = this.currentInput();
    if (!input) return;
    const token = ++this.token;
    let result: PcmAudio;
    try {
      result = await renderPreview(input);
    } catch (err) {
      console.warn('Preview render failed', err);
      return;
    }
    if (token !== this.token) return;
    this.onRendered({ ...result, wave: waveformOf(result.channels), peak: peakAbs(result.channels) });
  }
}
