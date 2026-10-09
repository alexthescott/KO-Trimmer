import { h } from '../dom';
import { formatBytes, formatSizeChange } from '../format';
import type { FileEntry } from '../../app/types';
import { formatLabel, formatShortLabel, sameFormat } from '../../audio/sampleFormat';
import { chooseOutputFormat, outputContainerFor } from '../../audio/outputContainer';
import type { FileEstimate } from '../../app/batchEstimate';
import { extensionOf } from '../../app/fileNames';

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
  /** The Preserve Bit Depth setting, which decides the bit-depth tags. */
  preserveBitDepth: boolean;
}

export class FileTable {
  element: HTMLElement;
  selectedId: string | null = null;
  private options: FileTableOptions;
  private preserveBitDepth: boolean;
  private lastFiles: FileEntry[] = [];
  private estimates = new Map<string, FileEstimate>();
  private sizeCells = new Map<string, HTMLElement>();
  private nameCells = new Map<string, HTMLElement>();
  private statusCells = new Map<string, HTMLElement>();
  private rowIndexById = new Map<string, number>();

  constructor(options: FileTableOptions) {
    this.options = options;
    this.preserveBitDepth = options.preserveBitDepth;
    this.element = h('table', { class: 'file-table' });
  }

  select(id: string | null): void {
    this.selectedId = id;
    this.render(this.lastFiles);
    const file = this.lastFiles.find((f) => f.id === id);
    if (file) this.options.onSelect?.(file);
  }

  /** Re-tags every row when the setting actually changes (settings fire on every slider tick). */
  setPreserveBitDepth(value: boolean): void {
    if (value === this.preserveBitDepth) return;
    this.preserveBitDepth = value;
    this.render(this.lastFiles);
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

  /** Records one file's estimate and updates its Size and name cells in place. */
  setEstimate(id: string, estimate: FileEstimate): void {
    this.estimates.set(id, estimate);
    const file = this.lastFiles.find((f) => f.id === id);
    if (!file) return;
    this.sizeCells.get(id)?.replaceChildren(sizeText(file, estimate.bytes));
    this.nameCells.get(id)?.replaceChildren(...this.nameCellContents(file, estimate.peak));
  }

  /** Patches one row's cells in place — O(1) DOM work, unlike a full render. */
  updateRow(file: FileEntry): void {
    const idx = this.rowIndexById.get(file.id);
    if (idx === undefined) return;
    this.lastFiles[idx] = file;
    const estimate = this.estimates.get(file.id);
    this.nameCells.get(file.id)?.replaceChildren(...this.nameCellContents(file, estimate?.peak));
    this.sizeCells.get(file.id)?.replaceChildren(sizeText(file, estimate?.bytes));
    const statusCell = this.statusCells.get(file.id);
    if (statusCell) {
      statusCell.className = `status status-${file.status}`;
      statusCell.textContent = statusText(file);
    }
  }

  render(files: FileEntry[]): void {
    this.lastFiles = [...files];
    this.sizeCells.clear();
    this.nameCells.clear();
    this.statusCells.clear();
    this.rowIndexById = new Map(files.map((f, i) => [f.id, i]));
    if (files.length === 0) {
      this.element.replaceChildren(h('tbody', {}, [h('tr', {}, [h('td', {}, ['No files added yet.'])])]));
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
      const estimate = this.estimates.get(file.id);
      const sizeCell = h('td', { class: 'readout size-cell' }, [sizeText(file, estimate?.bytes)]);
      this.sizeCells.set(file.id, sizeCell);
      const nameCell = h('td', {}, this.nameCellContents(file, estimate?.peak));
      this.nameCells.set(file.id, nameCell);
      const statusCell = h('td', { class: `status status-${file.status}` }, [statusText(file)]);
      this.statusCells.set(file.id, statusCell);
      const row = h('tr', { class: file.id === this.selectedId ? 'selected' : '' }, [
        nameCell,
        sizeCell,
        statusCell,
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

  private nameCellContents(file: FileEntry, peak: number | undefined): Array<Node | string> {
    const tags = [
      file.manualTrim ? h('span', { class: 'tag' }, ['manual trim']) : null,
      bitDepthTag(file, this.preserveBitDepth, peak),
    ];
    return [file.relativePath, ...tags.filter((tag): tag is HTMLElement => tag !== null)];
  }
}

function statusText(file: FileEntry): string {
  switch (file.status) {
    case 'queued':
      return 'Queued';
    case 'processing':
      return file.stage ? (STAGE_LABEL[file.stage] ?? 'Processing…') : 'Processing…';
    case 'done': {
      if (!file.stats) return 'Done';
      const warn = file.warning ? ` — ${file.warning}` : '';
      return `Trimmed (${formatSizeChange(file.stats.originalBytes, file.stats.outputBytes)})${warn}`;
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

/**
 * Tag for files whose bit depth changes on output, e.g. "32f→16", or that
 * stay 32-bit float because a lower bit depth would clip (`peak` from the
 * estimate; the title says why).
 */
function bitDepthTag(file: FileEntry, preserveBitDepth: boolean, peak: number | undefined): HTMLElement | null {
  const source = file.sourceFormat;
  const container = outputContainerFor(extensionOf(file.name));
  const { format: output, clipNote } = chooseOutputFormat(container, source, preserveBitDepth, peak);
  if (clipNote) return h('span', { class: 'tag', title: clipNote }, ['32f · avoids clip']);
  if (!source || !output || sameFormat(source, output)) return null;
  return h('span', { class: 'tag', title: `${formatLabel(source)} → ${formatLabel(output)}` }, [
    `${formatShortLabel(source)}→${formatShortLabel(output)}`,
  ]);
}
