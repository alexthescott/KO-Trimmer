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
  private estimates = new Map<string, number>();
  private sizeCells = new Map<string, HTMLElement>();

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

  /** Moves the selection `delta` rows up/down, clamped to the list. */
  selectAdjacent(delta: number): void {
    if (this.lastFiles.length === 0) return;
    const current = this.lastFiles.findIndex((f) => f.id === this.selectedId);
    const next = current === -1 ? 0 : Math.min(this.lastFiles.length - 1, Math.max(0, current + delta));
    if (next === current) return;
    this.select(this.lastFiles[next].id);
    this.element.querySelector('tr.selected')?.scrollIntoView({ block: 'nearest' });
  }

  /** Records one file's estimated output bytes and updates its Size cell in place. */
  setEstimate(id: string, estimatedBytes: number): void {
    this.estimates.set(id, estimatedBytes);
    const file = this.lastFiles.find((f) => f.id === id);
    const cell = this.sizeCells.get(id);
    if (file && cell) cell.textContent = sizeText(file, estimatedBytes);
  }

  render(files: FileEntry[]): void {
    this.lastFiles = files;
    this.sizeCells.clear();
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
      const sizeCell = h('td', { class: 'readout size-cell' }, [sizeText(file, this.estimates.get(file.id))]);
      this.sizeCells.set(file.id, sizeCell);
      const row = h('tr', { class: file.id === this.selectedId ? 'selected' : '' }, [
        h('td', {}, [file.relativePath, file.manualTrim ? h('span', { class: 'tag' }, ['manual trim']) : null]),
        sizeCell,
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
          h('th', { title: 'Original → new size (~ = estimate)' }, ['Size']),
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

/** "old → new": actual output size once processed, otherwise the estimate (prefixed ~). */
function sizeText(file: FileEntry, estimate: number | undefined): string {
  const original = formatBytes(file.size);
  if (file.status === 'done' && file.stats) return `${original} → ${formatBytes(file.stats.outputBytes)}`;
  if (estimate !== undefined) return `${original} → ~${formatBytes(estimate)}`;
  return `${original} → —`;
}
