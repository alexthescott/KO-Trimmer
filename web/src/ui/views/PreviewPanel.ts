import { h, formatBytes, formatDuration } from '../dom';
import type { FileEntry } from '../../app/types';

/**
 * Original vs. trimmed playback via native <audio> elements, sourced from
 * in-memory Blobs. Gated to 'done' rows, matching desktop's
 * update_preview_button_state gating.
 */
export class PreviewPanel {
  element: HTMLElement;
  private originalUrl?: string;

  constructor() {
    this.element = h('div', { class: 'panel', style: 'display:none' });
  }

  show(file: FileEntry): void {
    if (file.status !== 'done' || !file.resultBlobUrl) {
      this.hide();
      return;
    }

    this.revokeOriginal();
    this.originalUrl = URL.createObjectURL(file.file ?? new Blob());

    const stats = file.stats;
    const reduction = stats
      ? Math.round((1 - stats.outputBytes / Math.max(1, stats.originalBytes)) * 100)
      : 0;

    this.element.replaceChildren(
      h('h3', {}, [`Preview: ${file.name}`]),
      h('div', { class: 'preview-grid' }, [
        h('div', {}, [
          h('p', { class: 'muted' }, ['Original']),
          h('audio', { controls: true, src: this.originalUrl }),
          stats ? h('p', { class: 'muted' }, [`${formatBytes(stats.originalBytes)} · ${formatDuration(stats.originalDurationSec)}`]) : null,
        ]),
        h('div', {}, [
          h('p', { class: 'muted' }, ['Trimmed']),
          h('audio', { controls: true, src: file.resultBlobUrl }),
          stats
            ? h('p', { class: 'muted' }, [
                `${formatBytes(stats.outputBytes)} · ${formatDuration(stats.outputDurationSec)} (${
                  reduction >= 0 ? '−' : '+'
                }${Math.abs(reduction)}%)`,
              ])
            : null,
        ]),
      ]),
      h('button', { onclick: () => this.hide() }, ['Close Preview']),
    );
    this.element.style.display = '';
  }

  hide(): void {
    this.revokeOriginal();
    this.element.style.display = 'none';
    this.element.replaceChildren();
  }

  private revokeOriginal(): void {
    if (this.originalUrl) {
      URL.revokeObjectURL(this.originalUrl);
      this.originalUrl = undefined;
    }
  }
}
