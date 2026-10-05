import { h } from '../dom';
import { appState } from '../../app/state';
import { appEvents } from '../../app/events';
import { getDecoded } from '../../app/decodedCache';
import { errorMessage } from '../../app/errors';
import { extensionOf } from '../../app/fileNames';
import type { FileEntry, SampleRange } from '../../app/types';
import type { TrimBounds } from '../../audio/trim';
import { computeAutoTrimBounds, type RenderInput } from '../../audio/pipeline';
import { frameCount, type PcmAudio } from '../../audio/channels';
import { outputContainerFor, type OutputContainer } from '../../audio/outputContainer';
import { playChannels, stopPlayback, type PlaybackHandle } from '../../audio/player';
import { Viewport } from './waveform/Viewport';
import { PreviewRenderer, type ProcessedPreview } from './waveform/PreviewRenderer';
import { trimInfoText, sizeSummaryText } from './waveform/readouts';
import {
  dimOutside,
  drawHandle,
  drawPlayhead,
  drawWave,
  prepareCanvas,
  readColors,
  waveformOf,
  type Waveform,
} from './waveform/draw';

const HANDLE_HIT_PX = 8;
const ZOOM_IN_FACTOR = 0.8;
const ZOOM_OUT_FACTOR = 1.25;
const NO_FILE_TEXT = 'Select a file to see its waveform and trim points.';

type PlaybackTarget = 'original' | 'processed';
type DragTarget = 'start' | 'end' | null;

interface Playback {
  target: PlaybackTarget;
  handle: PlaybackHandle;
}

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
  private audio?: PcmAudio;
  private container: OutputContainer = 'wav';
  private original?: Waveform;
  private autoBounds?: TrimBounds;
  private trim: SampleRange = { start: 0, end: 0 };
  private viewport = new Viewport();
  private processed?: ProcessedPreview;
  private preview: PreviewRenderer;

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
    this.placeholderEl = h('p', { class: 'muted' }, [NO_FILE_TEXT]);

    this.originalCanvas = h('canvas', { class: 'wave-canvas wave-original' });
    this.processedCanvas = h('canvas', { class: 'wave-canvas wave-processed' });

    this.playOriginalButton = h('button', { onclick: () => this.togglePlay('original') }, [
      'Play Original',
    ]);
    this.playProcessedButton = h('button', { onclick: () => this.togglePlay('processed') }, [
      'Play Processed',
    ]);

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

    this.preview = new PreviewRenderer(
      () => this.previewInput(),
      (processed) => {
        this.processed = processed;
        this.updateReadouts();
        this.draw();
      },
    );

    this.bindCanvasEvents();
    this.resizeObserver = new ResizeObserver(() => this.draw());
    this.resizeObserver.observe(this.originalCanvas);
    this.resizeObserver.observe(this.processedCanvas);

    this.unsubscribers.push(
      appEvents.on('settings-changed', () => this.onSettingsChanged()),
      appEvents.on('files-changed', ({ files }) => {
        if (!this.file) return;
        const current = files.find((f) => f.id === this.file!.id);
        if (!current) void this.show(undefined);
        else this.file = current;
      }),
      appEvents.on('file-updated', ({ file }) => {
        if (this.file?.id === file.id) this.file = file;
      }),
    );
  }

  get hasFile(): boolean {
    return this.audio !== undefined;
  }

  async show(file: FileEntry | undefined): Promise<void> {
    this.stop();
    this.preview.cancel();
    const token = ++this.loadToken;
    this.file = file;
    this.audio = undefined;
    this.original = undefined;
    this.processed = undefined;
    this.autoBounds = undefined;

    if (!file) {
      this.titleEl.textContent = 'Preview';
      this.sizeEl.textContent = '';
      this.showPlaceholder(NO_FILE_TEXT);
      return;
    }

    this.titleEl.textContent = file.relativePath;
    this.sizeEl.textContent = '';
    this.showPlaceholder('Decoding…');

    let audio: PcmAudio;
    try {
      audio = await getDecoded(file);
    } catch (err) {
      if (token === this.loadToken) {
        this.showPlaceholder(`Couldn’t decode: ${errorMessage(err)}`);
      }
      return;
    }
    if (token !== this.loadToken) return;

    this.audio = audio;
    this.container = outputContainerFor(extensionOf(file.name));
    this.original = waveformOf(audio.channels);
    this.recomputeAuto();
    this.trim = file.manualTrim ? { ...file.manualTrim } : this.autoTrim();
    this.viewport.reset(this.length, audio.sampleRate);

    this.placeholderEl.style.display = 'none';
    this.bodyEl.style.display = '';
    this.updateReadouts();
    this.draw();
    this.preview.schedule(0);
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
    this.preview.cancel();
    this.unsubscribers.forEach((u) => u());
  }

  private showPlaceholder(text: string): void {
    this.placeholderEl.textContent = text;
    this.placeholderEl.style.display = '';
    this.bodyEl.style.display = 'none';
  }

  // ---- trim state ---------------------------------------------------------

  private get length(): number {
    return this.audio ? frameCount(this.audio.channels) : 0;
  }

  private get hasManual(): boolean {
    return this.file?.manualTrim !== undefined;
  }

  private recomputeAuto(): void {
    if (!this.audio) return;
    this.autoBounds = computeAutoTrimBounds(this.audio.channels, this.audio.sampleRate, appState.settings);
  }

  private autoTrim(): SampleRange {
    return this.autoBounds ? { start: this.autoBounds.start, end: this.autoBounds.end } : { start: 0, end: this.length };
  }

  private onSettingsChanged(): void {
    if (!this.audio) return;
    this.recomputeAuto();
    // Threshold changes only move handles on files without a manual override.
    if (!this.hasManual) this.trim = this.autoTrim();
    this.updateReadouts();
    this.draw();
    this.preview.schedule();
  }

  private commitManualTrim(): void {
    if (!this.file) return;
    appState.updateFile(this.file.id, { manualTrim: { ...this.trim } });
    this.updateReadouts();
    this.preview.schedule(0);
  }

  private clearManualTrim(): void {
    if (!this.file) return;
    appState.updateFile(this.file.id, { manualTrim: undefined });
    this.trim = this.autoTrim();
    this.updateReadouts();
    this.draw();
    this.preview.schedule(0);
  }

  private previewInput(): RenderInput | undefined {
    if (!this.audio) return undefined;
    return {
      channels: this.audio.channels,
      sampleRate: this.audio.sampleRate,
      bounds: { ...this.trim },
      container: this.container,
      settings: appState.settings,
    };
  }

  // ---- playback -----------------------------------------------------------

  private async togglePlay(target: PlaybackTarget): Promise<void> {
    if (this.playback?.target === target) {
      this.stop();
      return;
    }
    if (!this.audio) return;

    let source = this.audio;
    if (target === 'processed') {
      await this.preview.flush();
      if (!this.processed) return;
      source = this.processed;
    }

    const handle = playChannels(source.channels, source.sampleRate, () => {
      if (this.playback?.handle === handle) this.endPlayback();
    });
    if (!handle) return;
    this.playback = { target, handle };
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

  private playbackProportion(): number {
    if (!this.playback) return 0;
    const { handle } = this.playback;
    return handle.duration > 0 ? handle.position() / handle.duration : 0;
  }

  // ---- readouts -----------------------------------------------------------

  private updateReadouts(): void {
    if (!this.audio || !this.file) return;
    const input = {
      file: this.file,
      container: this.container,
      sampleRate: this.audio.sampleRate,
      channelCount: this.audio.channels.length,
      totalFrames: this.length,
      trim: this.trim,
      isManual: this.hasManual,
      autoWarning: this.autoBounds?.warning,
      processedPeak: this.processed?.peak,
      settings: appState.settings,
    };
    this.trimInfoEl.textContent = trimInfoText(input);
    this.sizeEl.textContent = sizeSummaryText(input);
  }

  // ---- pointer input ------------------------------------------------------

  /** 0..1 position of a pointer across the original canvas. */
  private pointerProportion(clientX: number): number {
    const rect = this.originalCanvas.getBoundingClientRect();
    return (clientX - rect.left) / Math.max(1, rect.width);
  }

  private hitTestHandle(clientX: number): DragTarget {
    const width = this.originalCanvas.getBoundingClientRect().width;
    const x = this.pointerProportion(clientX) * width;
    const startDist = Math.abs(x - this.viewport.proportionOf(this.trim.start) * width);
    const endDist = Math.abs(x - this.viewport.proportionOf(this.trim.end) * width);
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
      this.moveHandle(this.drag, this.viewport.sampleAt(this.pointerProportion(e.clientX)));
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
      if (this.hitTestHandle(e.clientX)) {
        this.clearManualTrim();
      } else {
        this.viewport.reset();
        this.draw();
      }
    });

    canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
  }

  private moveHandle(handle: 'start' | 'end', sample: number): void {
    const clamped = Math.round(Math.max(0, Math.min(this.length, sample)));
    if (handle === 'start') this.trim.start = Math.min(clamped, this.trim.end - 1);
    else this.trim.end = Math.max(clamped, this.trim.start + 1);
    this.updateReadouts();
    this.draw();
  }

  private handleWheel(e: WheelEvent): void {
    if (!this.audio) return;
    e.preventDefault();
    if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      this.viewport.pan(e.deltaX !== 0 ? e.deltaX : e.deltaY);
    } else {
      this.viewport.zoom(this.pointerProportion(e.clientX), e.deltaY < 0 ? ZOOM_IN_FACTOR : ZOOM_OUT_FACTOR);
    }
    this.draw();
  }

  // ---- drawing ------------------------------------------------------------

  private draw(): void {
    if (!this.audio || !this.original) return;
    const colors = readColors(this.element);

    const top = prepareCanvas(this.originalCanvas);
    if (top) {
      const { ctx, dpr } = top;
      const width = ctx.canvas.width;
      drawWave(ctx, this.original, this.viewport, colors.wave);
      const xStart = this.viewport.proportionOf(this.trim.start) * width;
      const xEnd = this.viewport.proportionOf(this.trim.end) * width;
      dimOutside(ctx, xStart, xEnd, colors.dim);
      drawHandle(ctx, xStart, dpr, colors.success);
      drawHandle(ctx, xEnd, dpr, colors.danger);
      if (this.playback?.target === 'original') {
        const playheadSample = this.playbackProportion() * this.length;
        drawPlayhead(ctx, this.viewport.proportionOf(playheadSample) * width, dpr, colors.accent);
      }
    }

    const bottom = prepareCanvas(this.processedCanvas);
    if (bottom && this.processed) {
      const { ctx, dpr } = bottom;
      drawWave(ctx, this.processed.wave, { start: 0, end: frameCount(this.processed.channels) }, colors.wave);
      if (this.playback?.target === 'processed') {
        drawPlayhead(ctx, this.playbackProportion() * ctx.canvas.width, dpr, colors.accent);
      }
    }
  }
}
