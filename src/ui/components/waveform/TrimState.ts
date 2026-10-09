import type { SampleRange } from '../../../app/types';
import type { PcmAudio } from '../../../audio/channels';
import { frameCount } from '../../../audio/channels';
import { computeAutoTrimBounds, type DetectionSettings } from '../../../audio/autoTrim';
import type { TrimBounds } from '../../../audio/trim';

export type TrimHandle = 'start' | 'end';

/**
 * The waveform editor's trim rules for one file, free of the DOM: auto
 * detection, dragging a handle, committing that as a manual override, and
 * reverting to auto. Settings changes only move the handles while there is
 * no manual override.
 */
export class TrimState {
  readonly frames: number;
  private auto: TrimBounds;
  private current: SampleRange;
  private manual: boolean;

  constructor(
    private readonly audio: PcmAudio,
    settings: DetectionSettings,
    manualTrim?: SampleRange,
  ) {
    this.frames = frameCount(audio.channels);
    this.auto = this.detect(settings);
    this.manual = manualTrim !== undefined;
    this.current = manualTrim ? { ...manualTrim } : this.autoRange();
  }

  /** The handles' positions, in source frames (end exclusive). */
  get range(): SampleRange {
    return { ...this.current };
  }

  get isManual(): boolean {
    return this.manual;
  }

  /** Auto-detection's "not trimmed" warning, if any. */
  get autoWarning(): string | undefined {
    return this.auto.warning;
  }

  /** Re-runs detection for new settings; the handles follow only while there's no manual override. */
  redetect(settings: DetectionSettings): void {
    this.auto = this.detect(settings);
    if (!this.manual) this.current = this.autoRange();
  }

  /** Moves a handle to `frame`, clamped to the file and never crossing the other handle. */
  moveHandle(handle: TrimHandle, frame: number): void {
    const clamped = Math.round(Math.max(0, Math.min(this.frames, frame)));
    if (handle === 'start') this.current.start = Math.min(clamped, this.current.end - 1);
    else this.current.end = Math.max(clamped, this.current.start + 1);
  }

  /** A drag ended: the current range becomes the manual override. */
  commitManual(): void {
    this.manual = true;
  }

  revertToAuto(): void {
    this.manual = false;
    this.current = this.autoRange();
  }

  private detect(settings: DetectionSettings): TrimBounds {
    return computeAutoTrimBounds(this.audio.channels, this.audio.sampleRate, settings);
  }

  private autoRange(): SampleRange {
    return { start: this.auto.start, end: this.auto.end };
  }
}
