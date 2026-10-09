import { h } from '../dom';
import { appState } from '../../app/state';
import { appEvents } from '../../app/events';
import { getDecoded } from '../../app/decodedCache';
import { errorMessage } from '../../app/errors';
import { extensionOf } from '../../app/fileNames';
import type { FileEntry } from '../../app/types';
import type { RenderInput } from '../../audio/pipeline';
import { frameCount, type PcmAudio } from '../../audio/channels';
import { outputContainerFor, type OutputContainer } from '../../audio/outputContainer';
import { Viewport } from './waveform/Viewport';
import { PreviewRenderer, type ProcessedPreview } from './waveform/PreviewRenderer';
import { trimInfoText, sizeSummaryText } from './waveform/readouts';
import { TrimState, type TrimHandle } from './waveform/TrimState';
import { PreviewPlayback, type PlaybackTarget } from './waveform/PreviewPlayback';
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

/** Everything known about the shown file once it has decoded; all set together. */
interface LoadedFile {
  audio: PcmAudio;
  original: Waveform;
  trim: TrimState;
  container: OutputContainer;
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
  private loaded?: LoadedFile;
  private viewport = new Viewport();
  private processed?: ProcessedPreview;
  private preview: PreviewRenderer;

  private drag?: TrimHandle;
  private playback = new PreviewPlayback({
    onStateChange: () => {
      this.updateButtons();
      this.draw();
    },
    onFrame: () => this.draw(),
  });

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

    this.playOriginalButton = h('button', { onclick: () => void this.togglePlay('original') }, ['Play Original']);
    this.playProcessedButton = h('button', { onclick: () => void this.togglePlay('processed') }, ['Play Processed']);

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
    return this.loaded !== undefined;
  }

  async show(file: FileEntry | undefined): Promise<void> {
    this.stop();
    this.preview.cancel();
    const token = ++this.loadToken;
    this.file = file;
    this.loaded = undefined;
    this.processed = undefined;

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

    this.loaded = {
      audio,
      original: waveformOf(audio.channels),
      trim: new TrimState(audio, appState.settings, file.manualTrim),
      container: outputContainerFor(extensionOf(file.name)),
    };
    this.viewport.reset(this.loaded.trim.frames, audio.sampleRate);

    this.placeholderEl.style.display = 'none';
    this.bodyEl.style.display = '';
    this.updateReadouts();
    this.draw();
    this.preview.schedule(0);
  }

  /** Space-bar behaviour: stop if anything is playing, else play the processed preview. */
  toggleDefaultPlayback(): void {
    if (this.playback.target) this.stop();
    else void this.togglePlay('processed');
  }

  stop(): void {
    this.playback.stop();
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

  // ---- trim ---------------------------------------------------------------

  private onSettingsChanged(): void {
    if (!this.loaded) return;
    this.loaded.trim.redetect(appState.settings);
    this.updateReadouts();
    this.draw();
    this.preview.schedule();
  }

  private commitManualTrim(): void {
    if (!this.file || !this.loaded) return;
    this.loaded.trim.commitManual();
    appState.updateFile(this.file.id, { manualTrim: this.loaded.trim.range });
    this.updateReadouts();
    this.preview.schedule(0);
  }

  private revertToAutoTrim(): void {
    if (!this.file || !this.loaded) return;
    this.loaded.trim.revertToAuto();
    appState.updateFile(this.file.id, { manualTrim: undefined });
    this.updateReadouts();
    this.draw();
    this.preview.schedule(0);
  }

  private previewInput(): RenderInput | undefined {
    if (!this.loaded) return undefined;
    const { audio, trim, container } = this.loaded;
    return { ...audio, bounds: trim.range, container, settings: appState.settings };
  }

  // ---- playback -----------------------------------------------------------

  private async togglePlay(target: PlaybackTarget): Promise<void> {
    if (this.playback.target === target) {
      this.stop();
      return;
    }
    const audio = await this.audioFor(target);
    if (audio) this.playback.start(target, audio);
  }

  /** The original audio, or the processed preview once its pending render is done. */
  private async audioFor(target: PlaybackTarget): Promise<PcmAudio | undefined> {
    if (!this.loaded) return undefined;
    if (target === 'original') return this.loaded.audio;
    await this.preview.flush();
    return this.processed;
  }

  private updateButtons(): void {
    const target = this.playback.target;
    this.playOriginalButton.textContent = target === 'original' ? 'Stop' : 'Play Original';
    this.playProcessedButton.textContent = target === 'processed' ? 'Stop' : 'Play Processed';
    this.playOriginalButton.classList.toggle('active', target === 'original');
    this.playProcessedButton.classList.toggle('active', target === 'processed');
  }

  // ---- readouts -----------------------------------------------------------

  private updateReadouts(): void {
    if (!this.loaded || !this.file) return;
    const { audio, trim, container } = this.loaded;
    const input = {
      file: this.file,
      container,
      sampleRate: audio.sampleRate,
      channelCount: audio.channels.length,
      totalFrames: trim.frames,
      trim: trim.range,
      isManual: trim.isManual,
      autoWarning: trim.autoWarning,
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

  /** The handle within HANDLE_HIT_PX of the pointer, if any. */
  private hitTestHandle(clientX: number): TrimHandle | undefined {
    if (!this.loaded) return undefined;
    const { start, end } = this.loaded.trim.range;
    const width = this.originalCanvas.getBoundingClientRect().width;
    const x = this.pointerProportion(clientX) * width;
    const startDist = Math.abs(x - this.viewport.proportionOf(start) * width);
    const endDist = Math.abs(x - this.viewport.proportionOf(end) * width);
    if (Math.min(startDist, endDist) > HANDLE_HIT_PX) return undefined;
    return startDist <= endDist ? 'start' : 'end';
  }

  private bindCanvasEvents(): void {
    const canvas = this.originalCanvas;

    canvas.addEventListener('pointerdown', (e) => {
      if (!this.loaded) return;
      this.drag = this.hitTestHandle(e.clientX);
      if (this.drag) canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!this.loaded) return;
      if (!this.drag) {
        canvas.style.cursor = this.hitTestHandle(e.clientX) ? 'ew-resize' : 'default';
        return;
      }
      this.loaded.trim.moveHandle(this.drag, this.viewport.sampleAt(this.pointerProportion(e.clientX)));
      this.updateReadouts();
      this.draw();
    });

    const endDrag = (e: PointerEvent) => {
      if (!this.drag) return;
      this.drag = undefined;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      this.commitManualTrim();
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    canvas.addEventListener('dblclick', (e) => {
      if (!this.loaded) return;
      if (this.hitTestHandle(e.clientX)) {
        this.revertToAutoTrim();
      } else {
        this.viewport.reset();
        this.draw();
      }
    });

    canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
  }

  private handleWheel(e: WheelEvent): void {
    if (!this.loaded) return;
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
    if (!this.loaded) return;
    const { original, trim } = this.loaded;
    const { start, end } = trim.range;
    const colors = readColors(this.element);

    const top = prepareCanvas(this.originalCanvas);
    if (top) {
      const { ctx, dpr } = top;
      const width = ctx.canvas.width;
      drawWave(ctx, original, this.viewport, colors.wave);
      const xStart = this.viewport.proportionOf(start) * width;
      const xEnd = this.viewport.proportionOf(end) * width;
      dimOutside(ctx, xStart, xEnd, colors.dim);
      drawHandle(ctx, xStart, dpr, colors.success);
      drawHandle(ctx, xEnd, dpr, colors.danger);
      if (this.playback.target === 'original') {
        const playheadSample = this.playback.progress * trim.frames;
        drawPlayhead(ctx, this.viewport.proportionOf(playheadSample) * width, dpr, colors.accent);
      }
    }

    const bottom = prepareCanvas(this.processedCanvas);
    if (bottom && this.processed) {
      const { ctx, dpr } = bottom;
      drawWave(ctx, this.processed.wave, { start: 0, end: frameCount(this.processed.channels) }, colors.wave);
      if (this.playback.target === 'processed') {
        drawPlayhead(ctx, this.playback.progress * ctx.canvas.width, dpr, colors.accent);
      }
    }
  }
}
