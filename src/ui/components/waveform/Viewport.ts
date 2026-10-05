import type { SampleRange } from '../../../app/types';

const MIN_VISIBLE_SAMPLES = 32;
const MIN_VISIBLE_SEC = 0.0005;
/** Deepest zoom shows at least 1/MAX_ZOOM of the file. */
const MAX_ZOOM = 2000;
const PAN_FRACTION = 0.15;

/**
 * The waveform editor's visible sample window: zoom around a point, pan,
 * and map between samples and 0..1 proportions of the canvas width.
 */
export class Viewport implements SampleRange {
  start = 0;
  end = 0;
  private total = 0;
  private sampleRate = 44100;

  /** Shows the whole file. */
  reset(total = this.total, sampleRate = this.sampleRate): void {
    this.total = total;
    this.sampleRate = sampleRate;
    this.start = 0;
    this.end = total;
  }

  get range(): number {
    return this.end - this.start;
  }

  /** Sample under a 0..1 proportion of the width. */
  sampleAt(proportion: number): number {
    return this.start + proportion * this.range;
  }

  /** 0..1 proportion of the width at `sample` (outside 0..1 when off-screen). */
  proportionOf(sample: number): number {
    return (sample - this.start) / Math.max(1, this.range);
  }

  /** Scales the visible range by `factor`, keeping the sample under `proportion` fixed. */
  zoom(proportion: number, factor: number): void {
    const anchor = this.sampleAt(proportion);
    const newRange = Math.min(this.total, this.range * factor);
    this.start = anchor - proportion * newRange;
    this.end = this.start + newRange;
    this.clamp();
  }

  /** Shifts the view a fixed fraction of its width; the sign of `direction` picks the side. */
  pan(direction: number): void {
    const delta = Math.sign(direction) * this.range * PAN_FRACTION;
    this.start += delta;
    this.end += delta;
    this.clamp();
  }

  private clamp(): void {
    const minRange = Math.max(
      MIN_VISIBLE_SAMPLES,
      Math.round(this.sampleRate * MIN_VISIBLE_SEC),
      Math.floor(this.total / MAX_ZOOM),
    );
    let range = Math.min(this.total, Math.max(minRange, this.range));
    let start = Math.max(0, Math.min(this.total - range, this.start));
    if (!Number.isFinite(start)) start = 0;
    if (!Number.isFinite(range)) range = this.total;
    this.start = start;
    this.end = start + range;
  }
}
