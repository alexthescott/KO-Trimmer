import { h, formatBytes } from '../dom';
import type { FileEntry } from '../../app/types';

const STAGE_LABEL: Record<string, string> = {
  decode: 'Decoding…',
  trim: 'Trimming…',
  downmix: 'Mixing…',
  speedup: 'Speeding up…',
  resample: 'Resampling…',
  encode: 'Encoding…',
};

export interface FileTableOptions {
  onSelect?: (file: FileEntry) => void;
  /** When provided, each row gets a remove (✕) button. */
  onRemove?: (file: FileEntry) => void;
}

export class FileTable {
  element: HTMLElement;
  selectedId: string | null = null;
  private options: FileTableOptions;
  private lastFiles: FileEntry[] = [];

  constructor(options: FileTableOptions = {}) {
    this.options = options;
    this.element = h('table', { class: 'file-table' });
  }

  select(id: string | null): void {
    this.selectedId = id;
    this.render(this.lastFiles);
    const file = this.lastFiles.find((f) => f.id === id);
    if (file) this.options.onSelect?.(file);
  }

  render(files: FileEntry[]): void {
    this.lastFiles = files;
    if (files.length === 0) {
      this.element.replaceChildren(
        h('tbody', {}, [h('tr', {}, [h('td', {}, ['No files added yet.'])])]),
      );
      return;
    }

    const rows = files.map((file) => {
      const removeCell = this.options.onRemove
        ? h('td', { class: 'row-action' }, [
            h(
              'button',
              {
                class: 'icon-button',
                title: 'Remove from list',
                'aria-label': `Remove ${file.name}`,
                onclick: (e: Event) => {
                  e.stopPropagation();
                  this.options.onRemove!(file);
                },
              },
              ['✕'],
            ),
          ])
        : null;
      const row = h('tr', { class: file.id === this.selectedId ? 'selected' : '' }, [
        h('td', {}, [file.relativePath, file.manualTrim ? h('span', { class: 'tag' }, ['manual trim']) : null]),
        h('td', { class: 'readout' }, [formatBytes(file.size)]),
        h('td', { class: `status status-${file.status}` }, [statusText(file)]),
        removeCell,
      ]);
      row.addEventListener('click', () => this.select(file.id));
      return row;
    });

    this.element.replaceChildren(
      h('thead', {}, [
        h('tr', {}, [
          h('th', {}, ['File']),
          h('th', {}, ['Size']),
          h('th', {}, ['Status']),
          this.options.onRemove ? h('th', {}, []) : null,
        ]),
      ]),
      h('tbody', {}, rows),
    );
  }
}

function statusText(file: FileEntry): string {
  switch (file.status) {
    case 'queued':
      return 'Queued';
    case 'processing':
      return file.stage ? STAGE_LABEL[file.stage] ?? 'Processing…' : 'Processing…';
    case 'done': {
      if (!file.stats) return 'Done';
      const reduction = Math.round(
        (1 - file.stats.outputBytes / Math.max(1, file.stats.originalBytes)) * 100,
      );
      const warn = file.warning ? ` — ${file.warning}` : '';
      return `Trimmed (${reduction >= 0 ? '−' : '+'}${Math.abs(reduction)}%)${warn}`;
    }
    case 'error':
      return `Error: ${file.error ?? 'unknown error'}`;
    case 'skipped':
      return 'Skipped';
    default:
      return file.status;
  }
}
