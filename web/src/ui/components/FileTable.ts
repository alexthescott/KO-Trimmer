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

export class FileTable {
  element: HTMLElement;
  private selectedId: string | null = null;
  private onSelect?: (file: FileEntry) => void;

  constructor(onSelect?: (file: FileEntry) => void) {
    this.onSelect = onSelect;
    this.element = h('table', { class: 'file-table' });
  }

  render(files: FileEntry[]): void {
    if (files.length === 0) {
      this.element.replaceChildren(
        h('tbody', {}, [h('tr', {}, [h('td', {}, ['No files added yet.'])])]),
      );
      return;
    }

    const rows = files.map((file) => {
      const row = h('tr', { class: file.id === this.selectedId ? 'selected' : '' }, [
        h('td', {}, [file.relativePath]),
        h('td', {}, [formatBytes(file.size)]),
        h('td', { class: `status-${file.status}` }, [statusText(file)]),
      ]);
      row.addEventListener('click', () => {
        this.selectedId = file.id;
        this.onSelect?.(file);
        this.render(files);
      });
      return row;
    });

    this.element.replaceChildren(
      h('thead', {}, [h('tr', {}, [h('th', {}, ['File']), h('th', {}, ['Size']), h('th', {}, ['Status'])])]),
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
