import type { SampleRange } from '../../../app/types';
import { frameCount } from '../../../audio/channels';

const PEAK_BLOCK = 256;

/** Per-block min/max, so drawing a zoomed-out view doesn't scan every sample. */
interface Peaks {
  min: Float32Array;
  max: Float32Array;
}

export interface Waveform {
  channels: Float32Array[];
  peaks: Peaks;
}

export interface WaveColors {
  wave: string;
  dim: string;
  accent: string;
  success: string;
  danger: string;
}

export function waveformOf(channels: Float32Array[]): Waveform {
  return { channels, peaks: computePeaks(channels) };
}

function computePeaks(channels: Float32Array[]): Peaks {
  const n = frameCount(channels);
  const blocks = Math.ceil(n / PEAK_BLOCK);
  const min = new Float32Array(blocks);
  const max = new Float32Array(blocks);
  for (let b = 0; b < blocks; b++) {
    [min[b], max[b]] = sampleExtent(channels, b * PEAK_BLOCK, Math.min(n, (b + 1) * PEAK_BLOCK));
  }
  return { min, max };
}

/** [min, max] over samples [from, to) of every channel, including 0. */
function sampleExtent(channels: Float32Array[], from: number, to: number): [number, number] {
  let lo = 0;
  let hi = 0;
  for (const channel of channels) {
    for (let i = from; i < to; i++) {
      const v = channel[i];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  return [lo, hi];
}

/** Min/max column per canvas pixel over the `visible` sample window. */
export function drawWave(ctx: CanvasRenderingContext2D, wave: Waveform, visible: SampleRange, color: string): void {
  const { width, height } = ctx.canvas;
  const { channels, peaks } = wave;
  const mid = height / 2;
  const samplesPerPx = (visible.end - visible.start) / Math.max(1, width);
  const n = frameCount(channels);
  ctx.fillStyle = color;

  for (let x = 0; x < width; x++) {
    const s0 = Math.max(0, Math.floor(visible.start + x * samplesPerPx));
    const s1 = Math.min(n, Math.max(s0 + 1, Math.floor(visible.start + (x + 1) * samplesPerPx)));
    if (s0 >= n) break;
    let lo = 0;
    let hi = 0;
    if (s1 - s0 >= PEAK_BLOCK) {
      const b1 = Math.ceil(s1 / PEAK_BLOCK);
      for (let b = Math.floor(s0 / PEAK_BLOCK); b < b1; b++) {
        if (peaks.min[b] < lo) lo = peaks.min[b];
        if (peaks.max[b] > hi) hi = peaks.max[b];
      }
    } else {
      [lo, hi] = sampleExtent(channels, s0, s1);
    }
    const y0 = mid - hi * mid;
    const y1 = mid - lo * mid;
    ctx.fillRect(x, y0, 1, Math.max(1, y1 - y0));
  }
}

/** Shades everything outside [xStart, xEnd] (canvas pixels). */
export function dimOutside(ctx: CanvasRenderingContext2D, xStart: number, xEnd: number, color: string): void {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = color;
  if (xStart > 0) ctx.fillRect(0, 0, Math.min(width, xStart), height);
  if (xEnd < width) ctx.fillRect(Math.max(0, xEnd), 0, width - Math.max(0, xEnd), height);
}

export function drawHandle(ctx: CanvasRenderingContext2D, x: number, dpr: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x - dpr), 0, 2 * dpr, ctx.canvas.height);
  ctx.fillRect(Math.round(x - 5 * dpr), 0, 10 * dpr, 10 * dpr);
}

/** Marks the handle keyboard nudges will move: a cap at the bottom, mirroring the handle's top cap. */
export function drawFocusMarker(ctx: CanvasRenderingContext2D, x: number, dpr: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x - 5 * dpr), ctx.canvas.height - 10 * dpr, 10 * dpr, 10 * dpr);
}

export function drawPlayhead(ctx: CanvasRenderingContext2D, x: number, dpr: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), 0, Math.max(1, dpr), ctx.canvas.height);
}

/** Sizes the backing store to CSS size × devicePixelRatio and clears it; null while hidden. */
export function prepareCanvas(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; dpr: number } | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const dpr = window.devicePixelRatio || 1;
  const width = Math.round(rect.width * dpr);
  const height = Math.round(rect.height * dpr);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, width, height);
  return { ctx, dpr };
}

/**
 * A visible canvas plus an offscreen copy of its static content (waveform,
 * dimming, handles), so the per-frame playhead during playback is one blit
 * instead of a full waveform repaint.
 */
export class LayeredCanvas {
  private base = document.createElement('canvas');
  private dpr = 1;

  constructor(readonly canvas: HTMLCanvasElement) {}

  /** Repaints the static layer and shows it alone; false while the canvas is hidden. */
  paint(paintStatic: (ctx: CanvasRenderingContext2D, dpr: number) => void): boolean {
    const prepared = prepareCanvas(this.canvas);
    const baseCtx = prepared && this.resizeBase();
    if (!prepared || !baseCtx) return false;
    this.dpr = prepared.dpr;
    paintStatic(baseCtx, prepared.dpr);
    prepared.ctx.drawImage(this.base, 0, 0);
    return true;
  }

  /** Shows the static layer with `paintOverlay` on top; false if the layer is stale and needs paint(). */
  overlay(paintOverlay: (ctx: CanvasRenderingContext2D, dpr: number) => void): boolean {
    const ctx = this.canvas.getContext('2d');
    if (!ctx || this.base.width !== this.canvas.width || this.base.height !== this.canvas.height) return false;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.base, 0, 0);
    paintOverlay(ctx, this.dpr);
    return true;
  }

  /** Matches the base layer to the visible canvas; assigning width/height also clears it. */
  private resizeBase(): CanvasRenderingContext2D | null {
    this.base.width = this.canvas.width;
    this.base.height = this.canvas.height;
    return this.base.getContext('2d');
  }
}

export function readColors(el: HTMLElement): WaveColors {
  const style = getComputedStyle(el);
  const v = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    wave: v('--text', '#1a1a1a'),
    dim: v('--trim-dim', 'rgba(213, 208, 200, 0.75)'),
    accent: v('--accent', '#ff6b2b'),
    success: v('--success', '#4caf50'),
    danger: v('--danger', '#c62828'),
  };
}
