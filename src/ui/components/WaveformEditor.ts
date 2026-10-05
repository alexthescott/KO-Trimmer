import { h, formatBytes, formatDuration } from '../dom';
import { appState } from '../../app/state';
import { appEvents } from '../../app/events';
import { getDecoded } from '../../app/decodedCache';
import type { FileEntry } from '../../app/types';
import type { DecodedAudio } from '../../audio/decode';
import type { TrimBounds } from '../../audio/trim';
import { computeAutoTrimBounds, renderPreview } from '../../audio/pipeline';
import { estimateOutputBytes } from '../../audio/estimate';
import { clipWarning, formatLabel, peakAbs, resolveOutputFormat, sameFormat } from '../../audio/sampleFormat';
import { playChannels, stopPlayback, type PlaybackHandle } from '../../audio/player';

const PEAK_BLOCK = 256;
const HANDLE_HIT_PX = 8;
const PREVIEW_DEBOUNCE_MS = 150;

interface Peaks {
  min: Float32Array;
  max: Float32Array;
}

interface Playback {
  target: 'original' | 'processed';
  handle: PlaybackHandle;
  /** Trim region at play time, so dragging handles mid-playback doesn't move the playhead. */
  trimSnapshot: { start: number; end: number };
}

type DragTarget = 'start' | 'end' | null;

/**
 * Before/after waveform with draggable trim handles, zoom/pan and live
 * preview playback — port of the JUCE KOTrimmer's WaveformEditor.
 * Dragged handles are stored per file as FileEntry.manualTrim, which the
 * batch pipeline then uses in place of auto-detection.
 */
export class WaveformEditor {
  element: HTMLElement;

  private file?: FileEntry;
  private loadToken = 0;
  private audio?: DecodedAudio;
  private extension = '';
  private peaks?: Peaks;
  private autoBounds?: TrimBounds;
  private trim = { start: 0, end: 0 };
  private viewStart = 0;
  private viewEnd = 0;

  private processed?: { channels: Float32Array[]; sampleRate: number; peaks: Peaks; peak: number };
  private previewPromise?: Promise<void>;
  private previewTimer?: number;
  private previewToken = 0;

  private drag: DragTarget = null;
  private playback?: Playback;
  private rafId?: number;

  private titleEl: HTMLElement;
  private sizeEl: HTMLElement;
  private trimInfoEl: HTMLElement;
  private placeholderEl: HTMLElement;
  private bodyEl: HTMLElement;
  private originalCanvas: HTMLCanvasElement;
  private processedCanvas: HTMLCanvasElement;
  private playOriginalButton: HTMLButtonElement;
  private playProcessedButton: HTMLButtonElement;
  private resizeObserver: ResizeObserver;
  private unsubscribers: Array<() => void> = [];

  constructor() {
    this.titleEl = h('h3', {}, ['Preview']);
    this.sizeEl = h('span', { class: 'readout' });
    this.trimInfoEl = h('div', { class: 'readout muted' });
    this.placeholderEl = h('p', { class: 'muted' }, ['Select a file to see its waveform and trim points.']);

    this.originalCanvas = h('canvas', { class: 'wave-canvas wave-original' }) as HTMLCanvasElement;
    this.processedCanvas = h('canvas', { class: 'wave-canvas wave-processed' }) as HTMLCanvasElement;

    this.playOriginalButton = h('button', { onclick: () => this.togglePlay('original') }, [
      'Play Original',
    ]) as HTMLButtonElement;
    this.playProcessedButton = h('button', { onclick: () => this.togglePlay('processed') }, [
      'Play Processed',
    ]) as HTMLButtonElement;

    this.bodyEl = h('div', { class: 'wave-body', style: 'display:none' }, [
      h('div', { class: 'wave-label' }, ['Original']),
      this.originalCanvas,
      this.trimInfoEl,
      h('div', { class: 'wave-label' }, ['Processed']),
      this.processedCanvas,
      h('div', { class: 'wave-controls' }, [
        this.playOriginalButton,
        this.playProcessedButton,
        h('small', { class: 'muted' }, [
          'Drag handles to trim · scroll to zoom · shift-scroll to pan · double-click a handle to reset · space to play',
        ]),
      ]),
    ]);

    this.element = h('div', { class: 'panel waveform-editor' }, [
      h('div', { class: 'panel-header' }, [this.titleEl, this.sizeEl]),
      this.placeholderEl,
      this.bodyEl,
    ]);

    this.bindCanvasEvents();
    this.resizeObserver = new ResizeObserver(() => this.draw());
    this.resizeObserver.observe(this.originalCanvas);
    this.resizeObserver.observe(this.processedCanvas);

    this.unsubscribers.push(
      appEvents.on('settings-changed', () => this.onSettingsChanged()),
      appEvents.on('files-changed', ({ files }) => {
        if (!this.file) return;
        const current = files.find((f) => f.id === this.file!.id);
        if (!current) this.show(undefined);
        else this.file = current;
      }),
    );
  }

  get hasFile(): boolean {
    return this.audio !== undefined;
  }

  async show(file: FileEntry | undefined): Promise<void> {
    this.stop();
    const token = ++this.loadToken;
    this.file = file;
    this.audio = undefined;
    this.peaks = undefined;
    this.processed = undefined;
    this.autoBounds = undefined;

    if (!file || !file.file) {
      this.titleEl.textContent = 'Preview';
      this.sizeEl.textContent = '';
      this.placeholderEl.textContent = file
        ? 'This file can’t be previewed.'
        : 'Select a file to see its waveform and trim points.';
      this.placeholderEl.style.display = '';
      this.bodyEl.style.display = 'none';
      return;
    }

    this.titleEl.textContent = file.relativePath;
    this.sizeEl.textContent = '';
    this.placeholderEl.textContent = 'Decoding…';
    this.placeholderEl.style.display = '';
    this.bodyEl.style.display = 'none';

    let audio: DecodedAudio;
    try {
      audio = await getDecoded(file);
    } catch (err) {
      if (token !== this.loadToken) return;
      this.placeholderEl.textContent = `Couldn’t decode: ${err instanceof Error ? err.message : String(err)}`;
      return;
    }
    if (token !== this.loadToken) return;

    this.audio = audio;
    this.extension = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
    this.peaks = computePeaks(audio.channels);
    this.recomputeAuto();
    this.trim = this.file?.manualTrim ? { ...this.file.manualTrim } : this.autoTrim();
    this.resetZoom();

    this.placeholderEl.style.display = 'none';
    this.bodyEl.style.display = '';
    this.updateReadouts();
    this.draw();
    this.schedulePreview(0);
  }

  /** Space-bar behaviour: stop if anything is playing, else play the processed preview. */
  toggleDefaultPlayback(): void {
    if (this.playback) this.stop();
    else void this.togglePlay('processed');
  }

  stop(): void {
    stopPlayback();
    this.endPlayback();
  }

  destroy(): void {
    this.stop();
    this.resizeObserver.disconnect();
    window.clearTimeout(this.previewTimer);
    this.unsubscribers.forEach((u) => u());
  }

  // ---- trim state ---------------------------------------------------------

  private get length(): number {
    return this.audio?.channels[0]?.length ?? 0;
  }

  private get hasManual(): boolean {
    return this.file?.manualTrim !== undefined;
  }

  private recomputeAuto(): void {
    if (!this.audio) return;
    this.autoBounds = computeAutoTrimBounds(this.audio.channels, this.audio.sampleRate, appState.settings);
  }

  private autoTrim(): { start: number; end: number } {
    return this.autoBounds ? { start: this.autoBounds.start, end: this.autoBounds.end } : { start: 0, end: this.length };
  }

  private onSettingsChanged(): void {
    if (!this.audio) return;
    this.recomputeAuto();
    // Threshold changes only move handles on files without a manual override.
    if (!this.hasManual) this.trim = this.autoTrim();
    this.updateReadouts();
    this.draw();
    this.schedulePreview();
  }

  private commitManualTrim(): void {
    if (!this.file) return;
    appState.updateFile(this.file.id, { manualTrim: { ...this.trim } });
    this.updateReadouts();
    this.schedulePreview(0);
  }

  private clearManualTrim(): void {
    if (!this.file) return;
    appState.updateFile(this.file.id, { manualTrim: undefined });
    this.trim = this.autoTrim();
    this.updateReadouts();
    this.draw();
    this.schedulePreview(0);
  }

  // ---- processed preview --------------------------------------------------

  private schedulePreview(delay = PREVIEW_DEBOUNCE_MS): void {
    window.clearTimeout(this.previewTimer);
    this.previewTimer = window.setTimeout(() => {
      this.previewPromise = this.renderProcessed();
    }, delay);
  }

  private async renderProcessed(): Promise<void> {
    if (!this.audio) return;
    const token = ++this.previewToken;
    const result = await renderPreview(
      this.audio.channels,
      this.audio.sampleRate,
      { start: this.trim.start, end: this.trim.end },
      this.extension,
      appState.settings,
    );
    if (token !== this.previewToken) return;
    this.processed = { ...result, peaks: computePeaks(result.channels), peak: peakAbs(result.channels) };
    this.updateReadouts();
    this.draw();
  }

  private async ensureFreshPreview(): Promise<void> {
    if (this.previewTimer !== undefined) {
      window.clearTimeout(this.previewTimer);
      this.previewTimer = undefined;
      this.previewPromise = this.renderProcessed();
    }
    await this.previewPromise;
  }

  // ---- playback -----------------------------------------------------------

  private async togglePlay(target: 'original' | 'processed'): Promise<void> {
    if (this.playback?.target === target) {
      this.stop();
      return;
    }
    if (!this.audio) return;

    let channels = this.audio.channels;
    let sampleRate = this.audio.sampleRate;
    if (target === 'processed') {
      await this.ensureFreshPreview();
      if (!this.processed) return;
      channels = this.processed.channels;
      sampleRate = this.processed.sampleRate;
    }

    const trimSnapshot = { ...this.trim };
    const handle = playChannels(channels, sampleRate, () => {
      if (this.playback?.handle === handle) this.endPlayback();
    });
    if (!handle) return;
    this.playback = { target, handle, trimSnapshot };
    this.updateButtons();
    this.tick();
  }

  private endPlayback(): void {
    this.playback = undefined;
    if (this.rafId !== undefined) cancelAnimationFrame(this.rafId);
    this.rafId = undefined;
    this.updateButtons();
    this.draw();
  }

  private tick = (): void => {
    this.draw();
    if (this.playback) this.rafId = requestAnimationFrame(this.tick);
  };

  private updateButtons(): void {
    const target = this.playback?.target;
    this.playOriginalButton.textContent = target === 'original' ? 'Stop' : 'Play Original';
    this.playProcessedButton.textContent = target === 'processed' ? 'Stop' : 'Play Processed';
    this.playOriginalButton.classList.toggle('active', target === 'original');
    this.playProcessedButton.classList.toggle('active', target === 'processed');
  }

  // ---- readouts -----------------------------------------------------------

  private updateReadouts(): void {
    if (!this.audio || !this.file) return;
    const sr = this.audio.sampleRate;
    const kept = this.trim.end - this.trim.start;
    const mode = this.hasManual ? 'MANUAL' : 'AUTO';
    const outputFormat =
      this.extension === 'mp3' ? undefined : resolveOutputFormat(this.file.sourceFormat, appState.settings.preserveBitDepth);
    const clip = outputFormat && this.processed ? clipWarning(this.processed.peak, outputFormat) : undefined;
    const warning =
      (!this.hasManual && this.autoBounds?.warning ? ` · ${this.autoBounds.warning}` : '') + (clip ? ` · ${clip}` : '');
    this.trimInfoEl.textContent =
      `${mode} · START ${formatDuration(this.trim.start / sr)} · END ${formatDuration(this.trim.end / sr)} · ` +
      `LENGTH ${formatDuration(kept / sr)} of ${formatDuration(this.length / sr)}${warning}`;

    const estimate = estimateOutputBytes({
      trimmedFrames: kept,
      sourceChannels: this.audio.channels.length,
      sourceSampleRate: sr,
      extension: this.extension,
      sourceFormat: this.file.sourceFormat,
      settings: appState.settings,
    });
    const pct = Math.round((1 - estimate / Math.max(1, this.file.size)) * 100);
    const source = this.file.sourceFormat;
    const depth =
      source && outputFormat
        ? sameFormat(source, outputFormat)
          ? ` · ${formatLabel(source)}${appState.settings.preserveBitDepth ? ' (kept)' : ''}`
          : ` · ${formatLabel(source)} → ${formatLabel(outputFormat)}`
        : '';
    this.sizeEl.textContent = `${formatBytes(this.file.size)} → ~${formatBytes(estimate)} (${pct >= 0 ? '−' : '+'}${Math.abs(pct)}%)${depth}`;
  }

  // ---- zoom / pan / drag --------------------------------------------------

  private resetZoom(): void {
    this.viewStart = 0;
    this.viewEnd = this.length;
  }

  private clampView(): void {
    const total = this.length;
    const minRange = Math.max(32, Math.round((this.audio?.sampleRate ?? 44100) * 0.0005), Math.floor(total / 2000));
    let range = Math.min(total, Math.max(minRange, this.viewEnd - this.viewStart));
    let start = Math.max(0, Math.min(total - range, this.viewStart));
    if (!Number.isFinite(start)) start = 0;
    if (!Number.isFinite(range)) range = total;
    this.viewStart = start;
    this.viewEnd = start + range;
  }

  private xToSample(clientX: number): number {
    const rect = this.originalCanvas.getBoundingClientRect();
    const proportion = (clientX - rect.left) / Math.max(1, rect.width);
    return this.viewStart + proportion * (this.viewEnd - this.viewStart);
  }

  private sampleToCssX(sample: number): number {
    const width = this.originalCanvas.getBoundingClientRect().width;
    return ((sample - this.viewStart) / Math.max(1, this.viewEnd - this.viewStart)) * width;
  }

  private hitTestHandle(clientX: number): DragTarget {
    const rect = this.originalCanvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const startDist = Math.abs(x - this.sampleToCssX(this.trim.start));
    const endDist = Math.abs(x - this.sampleToCssX(this.trim.end));
    if (Math.min(startDist, endDist) > HANDLE_HIT_PX) return null;
    return startDist <= endDist ? 'start' : 'end';
  }

  private bindCanvasEvents(): void {
    const canvas = this.originalCanvas;

    canvas.addEventListener('pointerdown', (e) => {
      if (!this.audio) return;
      this.drag = this.hitTestHandle(e.clientX);
      if (this.drag) canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!this.audio) return;
      if (!this.drag) {
        canvas.style.cursor = this.hitTestHandle(e.clientX) ? 'ew-resize' : 'default';
        return;
      }
      const sample = Math.round(Math.max(0, Math.min(this.length, this.xToSample(e.clientX))));
      if (this.drag === 'start') this.trim.start = Math.min(sample, this.trim.end - 1);
      else this.trim.end = Math.max(sample, this.trim.start + 1);
      this.updateReadouts();
      this.draw();
    });

    const endDrag = (e: PointerEvent) => {
      if (!this.drag) return;
      this.drag = null;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      this.commitManualTrim();
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    canvas.addEventListener('dblclick', (e) => {
      if (!this.audio) return;
      if (this.hitTestHandle(e.clientX)) this.clearManualTrim();
      else {
        this.resetZoom();
        this.draw();
      }
    });

    canvas.addEventListener(
      'wheel',
      (e) => {
        if (!this.audio) return;
        e.preventDefault();
        const range = this.viewEnd - this.viewStart;
        if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
          const amount = e.deltaX !== 0 ? e.deltaX : e.deltaY;
          const delta = Math.sign(amount) * range * 0.15;
          this.viewStart += delta;
          this.viewEnd += delta;
        } else {
          const factor = e.deltaY < 0 ? 0.8 : 1.25;
          const rect = canvas.getBoundingClientRect();
          const proportion = (e.clientX - rect.left) / Math.max(1, rect.width);
          const cursorSample = this.viewStart + proportion * range;
          const newRange = Math.min(this.length, range * factor);
          this.viewStart = cursorSample - proportion * newRange;
          this.viewEnd = this.viewStart + newRange;
        }
        this.clampView();
        this.draw();
      },
      { passive: false },
    );
  }

  // ---- drawing ------------------------------------------------------------

  private draw(): void {
    if (!this.audio || !this.peaks) return;
    const colors = readColors(this.element);

    const top = prepareCanvas(this.originalCanvas);
    if (top) {
      const { ctx, width, height, dpr } = top;
      drawWave(ctx, this.audio.channels, this.peaks, this.viewStart, this.viewEnd, width, height, colors.wave);

      const xStart = this.sampleToCssX(this.trim.start) * dpr;
      const xEnd = this.sampleToCssX(this.trim.end) * dpr;
      ctx.fillStyle = colors.dim;
      if (xStart > 0) ctx.fillRect(0, 0, Math.min(width, xStart), height);
      if (xEnd < width) ctx.fillRect(Math.max(0, xEnd), 0, width - Math.max(0, xEnd), height);
      drawHandle(ctx, xStart, height, dpr, colors.success);
      drawHandle(ctx, xEnd, height, dpr, colors.danger);

      if (this.playback) {
        const p = this.playbackProportion();
        const sample =
          this.playback.target === 'original'
            ? p * this.length
            : this.playback.trimSnapshot.start + p * (this.playback.trimSnapshot.end - this.playback.trimSnapshot.start);
        drawPlayhead(ctx, this.sampleToCssX(sample) * dpr, height, dpr, colors.accent);
      }
    }

    const bottom = prepareCanvas(this.processedCanvas);
    if (bottom && this.processed) {
      const { ctx, width, height, dpr } = bottom;
      const len = this.processed.channels[0]?.length ?? 0;
      drawWave(ctx, this.processed.channels, this.processed.peaks, 0, len, width, height, colors.wave);
      if (this.playback?.target === 'processed') {
        drawPlayhead(ctx, this.playbackProportion() * width, height, dpr, colors.accent);
      }
    }
  }

  private playbackProportion(): number {
    if (!this.playback) return 0;
    const { handle } = this.playback;
    return handle.duration > 0 ? handle.position() / handle.duration : 0;
  }
}

// ---- pure drawing helpers -------------------------------------------------

function computePeaks(channels: Float32Array[]): Peaks {
  const n = channels[0]?.length ?? 0;
  const blocks = Math.ceil(n / PEAK_BLOCK);
  const min = new Float32Array(blocks);
  const max = new Float32Array(blocks);
  for (let b = 0; b < blocks; b++) {
    let lo = 0;
    let hi = 0;
    const end = Math.min(n, (b + 1) * PEAK_BLOCK);
    for (const channel of channels) {
      for (let i = b * PEAK_BLOCK; i < end; i++) {
        const v = channel[i];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    min[b] = lo;
    max[b] = hi;
  }
  return { min, max };
}

function drawWave(
  ctx: CanvasRenderingContext2D,
  channels: Float32Array[],
  peaks: Peaks,
  viewStart: number,
  viewEnd: number,
  width: number,
  height: number,
  color: string,
): void {
  const mid = height / 2;
  const samplesPerPx = (viewEnd - viewStart) / Math.max(1, width);
  const n = channels[0]?.length ?? 0;
  ctx.fillStyle = color;

  for (let x = 0; x < width; x++) {
    const s0 = Math.max(0, Math.floor(viewStart + x * samplesPerPx));
    const s1 = Math.min(n, Math.max(s0 + 1, Math.floor(viewStart + (x + 1) * samplesPerPx)));
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
      for (const channel of channels) {
        for (let i = s0; i < s1; i++) {
          const v = channel[i];
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
      }
    }
    const y0 = mid - hi * mid;
    const y1 = mid - lo * mid;
    ctx.fillRect(x, y0, 1, Math.max(1, y1 - y0));
  }
}

function drawHandle(ctx: CanvasRenderingContext2D, x: number, height: number, dpr: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x - dpr), 0, 2 * dpr, height);
  ctx.fillRect(Math.round(x - 5 * dpr), 0, 10 * dpr, 10 * dpr);
}

function drawPlayhead(ctx: CanvasRenderingContext2D, x: number, height: number, dpr: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), 0, Math.max(1, dpr), height);
}

function prepareCanvas(
  canvas: HTMLCanvasElement,
): { ctx: CanvasRenderingContext2D; width: number; height: number; dpr: number } | null {
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
  return { ctx, width, height, dpr };
}

function readColors(el: HTMLElement): { wave: string; dim: string; accent: string; success: string; danger: string } {
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
