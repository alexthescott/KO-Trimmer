import { h, formatBytes, formatSizeChange, plural } from '../dom';
import { appState } from '../../app/state';
import { appEvents } from '../../app/events';
import { evictDecoded } from '../../app/decodedCache';
import { BatchEstimator, type BatchEstimate } from '../../app/batchEstimate';
import { DropZone } from '../components/DropZone';
import { SettingsPanel } from '../components/SettingsPanel';
import { FileTable } from '../components/FileTable';
import { WaveformEditor } from '../components/WaveformEditor';
import { pickWritableDirectory } from '../../fs/directoryPicker';
import { canOverwrite } from '../../fs/overwriteWriter';
import type { FileEntry } from '../../app/types';

const ESTIMATE_DEBOUNCE_MS = 300;

export class MainView {
  element: HTMLElement;
  private fileTable: FileTable;
  private settingsPanel: SettingsPanel;
  private waveformEditor: WaveformEditor;
  private outputLocationEl: HTMLElement;
  private batchEstimateEl: HTMLElement;
  private processButton: HTMLButtonElement;
  private estimator = new BatchEstimator();
  private estimateTimer?: number;
  private unsubscribers: Array<() => void> = [];
  private lastPreserveBitDepth = appState.settings.preserveBitDepth;

  constructor(onProcess: () => void) {
    this.waveformEditor = new WaveformEditor();
    this.fileTable = new FileTable({
      onSelect: (file: FileEntry) => void this.waveformEditor.show(file),
      onRemove: (file: FileEntry) => this.removeFile(file),
    });
    this.settingsPanel = new SettingsPanel();

    const dropZone = new DropZone();

    this.outputLocationEl = h('p', { class: 'muted' });
    this.batchEstimateEl = h('span', { class: 'readout muted' });

    this.processButton = h('button', {
      class: 'primary',
      disabled: true,
      onclick: () => void this.handleProcess(onProcess),
    }, ['Process Files']) as HTMLButtonElement;

    const clearButton = h('button', { onclick: () => this.handleClear() }, ['Clear All']);
    const chooseOutputButton = h('button', { onclick: () => this.handleChooseOutputDirectory() }, [
      'Choose output folder…',
    ]);

    const filePanel = h('div', { class: 'panel' }, [
      h('h3', {}, ['Files']),
      dropZone.element,
      this.fileTable.element,
      h('div', { style: 'display:flex; gap:8px; margin-top:8px; align-items:center' }, [
        clearButton,
        chooseOutputButton,
        this.outputLocationEl,
      ]),
    ]);

    const actionRow = h('div', { class: 'action-row' }, [this.batchEstimateEl, this.processButton]);

    this.element = h('div', { class: 'layout' }, [
      h('div', { class: 'main-column' }, [
        filePanel,
        this.waveformEditor.element,
        this.settingsPanel.element,
        actionRow,
      ]),
    ]);

    this.fileTable.render(appState.files);
    this.processButton.disabled = appState.files.length === 0;
    this.updateOutputLocation();
    this.scheduleEstimate();

    this.unsubscribers.push(
      appEvents.on('files-changed', ({ files }) => {
        this.fileTable.render(files);
        this.settingsPanel.refresh();
        this.processButton.disabled = files.length === 0;
        this.updateOutputLocation();
        if (this.fileTable.selectedId === null && files.length > 0) this.fileTable.select(files[0].id);
        this.scheduleEstimate();
      }),
      appEvents.on('settings-changed', ({ settings }) => {
        // Bit-depth tags depend on this setting; skip re-rendering on every slider tick.
        if (settings.preserveBitDepth !== this.lastPreserveBitDepth) {
          this.lastPreserveBitDepth = settings.preserveBitDepth;
          this.fileTable.render(appState.files);
        }
        this.scheduleEstimate();
      }),
    );

    document.addEventListener('keydown', this.handleKeyDown);
  }

  // ---- keyboard (port of JUCE MainComponent::keyPressed) -------------------

  private handleKeyDown = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('input, select, textarea, button, [contenteditable]')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (appState.files.length === 0) return;
      e.preventDefault();
      this.fileTable.selectAdjacent(e.key === 'ArrowDown' ? 1 : -1);
    } else if (e.key === ' ') {
      if (!this.waveformEditor.hasFile) return;
      e.preventDefault();
      this.waveformEditor.toggleDefaultPlayback();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      const file = appState.files.find((f) => f.id === this.fileTable.selectedId);
      if (!file) return;
      e.preventDefault();
      if (confirm(`Remove "${file.name}" from the list?\n\nThe file on disk is not affected.`)) {
        this.removeFile(file);
      }
    }
  };

  private removeFile(file: FileEntry): void {
    const wasSelected = this.fileTable.selectedId === file.id;
    if (wasSelected) this.waveformEditor.stop();
    evictDecoded(file.id);
    const nextId = appState.removeFile(file.id);
    if (wasSelected) {
      this.fileTable.selectedId = null;
      if (nextId) this.fileTable.select(nextId);
      else void this.waveformEditor.show(undefined);
    }
  }

  private handleClear(): void {
    this.waveformEditor.stop();
    this.fileTable.selectedId = null;
    appState.files.forEach((f) => evictDecoded(f.id));
    appState.clearFiles();
    void this.waveformEditor.show(undefined);
  }

  // ---- processing ---------------------------------------------------------

  private async handleProcess(onProcess: () => void): Promise<void> {
    // Before any confirm(): the permission prompt needs the click's user activation.
    await appState.prepareOutputRoot();
    if (appState.settings.overwrite) {
      const count = appState.files.filter(canOverwrite).length;
      if (
        count > 0 &&
        !confirm(
          `Overwrite ${plural(count, 'original file')}?\n\n` +
            'The source files will be replaced with the trimmed versions. This cannot be undone.',
        )
      ) {
        return;
      }
    }
    this.waveformEditor.stop();
    onProcess();
  }

  // ---- batch size estimate ------------------------------------------------

  private scheduleEstimate(): void {
    window.clearTimeout(this.estimateTimer);
    this.estimator.cancel();
    if (appState.files.length === 0) {
      this.batchEstimateEl.textContent = '';
      return;
    }
    this.batchEstimateEl.textContent = 'Estimating…';
    this.estimateTimer = window.setTimeout(() => void this.runEstimate(), ESTIMATE_DEBOUNCE_MS);
  }

  private async runEstimate(): Promise<void> {
    const files = appState.files;
    this.estimator.forget(new Set(files.map((f) => f.id)));
    const result = await this.estimator.estimate(
      files,
      appState.settings,
      (id, estimate) => this.fileTable.setEstimate(id, estimate),
      (progress) => this.renderBatchEstimate(progress),
    );
    if (result) this.renderBatchEstimate(result);
  }

  private renderBatchEstimate(estimate: BatchEstimate): void {
    const { originalBytes, estimatedBytes, analysed, total } = estimate;
    const partial = analysed < total ? ` (analysed ${analysed}/${total})` : '';
    this.batchEstimateEl.textContent =
      `${plural(total, 'file')} · ${formatBytes(originalBytes)} → ` +
      `~${formatBytes(estimatedBytes)} (${formatSizeChange(originalBytes, estimatedBytes)})${partial}`;
  }

  // ---- output location ----------------------------------------------------

  private updateOutputLocation(): void {
    if (appState.files.length === 0) {
      this.outputLocationEl.textContent = '';
      return;
    }
    const folder = appState.outputFolderName;
    if (folder) {
      this.outputLocationEl.textContent = `Output: ${folder}/`;
    } else {
      this.outputLocationEl.textContent = 'Output: will download as a ZIP';
    }
  }

  private async handleChooseOutputDirectory(): Promise<void> {
    const handle = await pickWritableDirectory();
    if (!handle) return;
    appState.setOutputRoot(handle);
    this.updateOutputLocation();
  }

  destroy(): void {
    window.clearTimeout(this.estimateTimer);
    this.estimator.cancel();
    document.removeEventListener('keydown', this.handleKeyDown);
    this.waveformEditor.destroy();
    this.unsubscribers.forEach((u) => u());
  }
}
