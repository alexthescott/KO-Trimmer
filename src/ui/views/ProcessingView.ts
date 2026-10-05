import { h } from '../dom';
import { appState } from '../../app/state';
import { appEvents } from '../../app/events';
import { FileTable } from '../components/FileTable';
import { renderResultsSummary } from '../components/ResultsSummary';
import { processBatch, type BatchSummary } from '../../app/processBatch';
import { FsAccessOutputSink, ZipOutputSink, type OutputSink } from '../../fs/outputWriter';
import type { FileEntry } from '../../app/types';
import { TRIMMED_SUFFIX } from '../../fs/dragDropEntries';

export class ProcessingView {
  element: HTMLElement;
  private fileTable = new FileTable();
  private overallFill: HTMLElement;
  private statusLabel: HTMLElement;
  private logEl: HTMLElement;
  private stopButton: HTMLButtonElement;
  private closeButton: HTMLButtonElement;
  private resultsContainer: HTMLElement;
  private controller = new AbortController();
  private total: number;
  private finishedCount = 0;
  /** Row updates waiting for the next frame; workers can report far faster than the screen redraws. */
  private pendingUpdates = new Map<string, FileEntry>();
  private flushFrame?: number;
  private unsubscribe: () => void;
  private onDone: () => void;

  constructor(files: FileEntry[], onDone: () => void) {
    this.onDone = onDone;
    this.total = files.length;

    this.overallFill = h('div', { class: 'progress-bar-fill' });
    this.statusLabel = h('p', {}, ['Processing files…']);
    this.logEl = h('div', { class: 'log' });
    this.resultsContainer = h('div');

    this.stopButton = h('button', { class: 'danger', onclick: () => this.handleStop() }, [
      'Stop Processing',
    ]) as HTMLButtonElement;
    this.closeButton = h('button', { disabled: true, onclick: () => this.onDone() }, [
      'Close',
    ]) as HTMLButtonElement;

    this.element = h('div', { class: 'main-column' }, [
      h('div', { class: 'panel' }, [
        h('h3', {}, ['Processing']),
        this.statusLabel,
        h('div', { class: 'progress-bar' }, [this.overallFill]),
        this.fileTable.element,
        this.logEl,
        h('div', { style: 'display:flex; gap:8px; margin-top:8px' }, [this.stopButton, this.closeButton]),
      ]),
      this.resultsContainer,
    ]);

    this.fileTable.render(files);

    this.unsubscribe = appEvents.on('file-updated', ({ file }) => {
      this.pendingUpdates.set(file.id, file);
      this.flushFrame ??= requestAnimationFrame(() => this.flushUpdates());
    });

    this.run(files);
  }

  /** Applies the frame's row updates, logs newly finished files, and advances the progress bar. */
  private flushUpdates(): void {
    this.flushFrame = undefined;
    const logLines: HTMLElement[] = [];
    for (const file of this.pendingUpdates.values()) {
      this.fileTable.updateRow(file);
      // Each file reaches a final status exactly once (recordOutcome), so no dedupe needed.
      if (!isFinished(file)) continue;
      this.finishedCount++;
      const icon = file.status === 'done' ? '✅' : file.status === 'error' ? '❌' : '⏭️';
      logLines.push(h('div', {}, [`${icon} ${file.relativePath}${file.error ? ' — ' + file.error : ''}`]));
    }
    this.pendingUpdates.clear();
    if (logLines.length === 0) return;

    this.logEl.append(...logLines);
    this.logEl.scrollTop = this.logEl.scrollHeight;
    const pct = this.total > 0 ? (this.finishedCount / this.total) * 100 : 0;
    this.overallFill.style.width = `${pct}%`;
  }

  private handleStop(): void {
    this.controller.abort();
    this.stopButton.disabled = true;
    this.statusLabel.textContent = 'Stopping…';
  }

  private buildOutputSink(): OutputSink {
    if (appState.outputRootHandle) {
      return new FsAccessOutputSink(appState.outputRootHandle);
    }
    const zipName = `${appState.rootName ?? 'sample-trimmer-output'}${TRIMMED_SUFFIX}.zip`;
    return new ZipOutputSink(zipName);
  }

  private describeOutput(): string {
    if (appState.outputRootHandle) {
      return `Written to "${appState.outputRootHandle.name}/"`;
    }
    return 'Downloaded as a ZIP file';
  }

  private async run(files: FileEntry[]): Promise<void> {
    const sink = this.buildOutputSink();
    let summary: BatchSummary;
    try {
      summary = await processBatch(files, appState.settings, sink, this.controller.signal);
    } catch (err) {
      this.statusLabel.textContent = `Processing failed: ${err instanceof Error ? err.message : String(err)}`;
      this.stopButton.style.display = 'none';
      this.closeButton.disabled = false;
      return;
    }

    this.statusLabel.textContent = summary.aborted ? 'Stopped.' : 'Processing complete!';
    this.stopButton.style.display = 'none';
    this.closeButton.disabled = false;
    this.resultsContainer.replaceChildren(renderResultsSummary(summary, this.describeOutput()));
  }

  destroy(): void {
    this.unsubscribe();
    if (this.flushFrame !== undefined) cancelAnimationFrame(this.flushFrame);
  }
}

function isFinished(file: FileEntry): boolean {
  return file.status === 'done' || file.status === 'error' || file.status === 'skipped';
}
