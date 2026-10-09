import { h } from '../dom';
import { formatBytes, formatSizeChange, plural } from '../format';
import { appState } from '../../app/state';
import { appEvents } from '../../app/events';
import { evictDecoded } from '../../app/decodedCache';
import type { BatchEstimate } from '../../app/batchEstimate';
import { EstimateScheduler } from '../../app/estimateScheduler';
import { DropZone } from '../components/DropZone';
import { SettingsPanel } from '../components/SettingsPanel';
import { FileTable } from '../components/FileTable';
import { WaveformEditor } from '../components/WaveformEditor';
import { pickWritableDirectory } from '../../fs/directoryPicker';
import { canOverwrite } from '../../fs/overwriteWriter';
import { isFileSystemAccessSupported } from '../../fs/capabilities';
import type { FileEntry } from '../../app/types';

export class MainView {
  element: HTMLElement;
  private fileTable: FileTable;
  private settingsPanel: SettingsPanel;
  private waveformEditor: WaveformEditor;
  private outputLocationEl: HTMLElement;
  private batchEstimateEl: HTMLElement;
  private processButton: HTMLButtonElement;
  private estimates = new EstimateScheduler({
    current: () => ({ files: appState.files, settings: appState.settings }),
    listener: {
      onEmpty: () => (this.batchEstimateEl.textContent = ''),
      onPending: () => (this.batchEstimateEl.textContent = 'Estimating…'),
      onFile: (id, estimate) => this.fileTable.setEstimate(id, estimate),
      onTotal: (estimate) => this.renderBatchEstimate(estimate),
    },
  });
  private unsubscribers: Array<() => void> = [];

  constructor(onProcess: () => void) {
    this.waveformEditor = new WaveformEditor();
    this.fileTable = new FileTable({
      onSelect: (file: FileEntry) => void this.waveformEditor.show(file),
      onRemove: (file: FileEntry) => this.removeFile(file),
      preserveBitDepth: appState.settings.preserveBitDepth,
    });
    this.settingsPanel = new SettingsPanel();

    const dropZone = new DropZone();

    this.outputLocationEl = h('p', { class: 'muted' });
    this.batchEstimateEl = h('span', { class: 'readout muted' });

    this.processButton = h(
      'button',
      {
        class: 'primary',
        disabled: true,
        onclick: () => void this.handleProcess(onProcess),
      },
      ['Process Files'],
    );

    const clearButton = h('button', { onclick: () => this.handleClear() }, ['Clear All']);
    const canPickFolder = isFileSystemAccessSupported();
    const chooseOutputButton = h(
      'button',
      {
        disabled: !canPickFolder,
        title: canPickFolder ? undefined : 'This browser can’t write to folders, so output downloads as a ZIP.',
        onclick: () => void this.handleChooseOutputDirectory(),
      },
      ['Choose output folder…'],
    );

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
    this.estimates.schedule();

    this.unsubscribers.push(
      appEvents.on('files-changed', ({ files }) => {
        this.fileTable.render(files);
        this.settingsPanel.refresh();
        this.processButton.disabled = files.length === 0;
        this.updateOutputLocation();
        if (this.fileTable.selectedId === null && files.length > 0) this.fileTable.select(files[0].id);
        this.estimates.schedule();
      }),
      appEvents.on('file-updated', ({ file }) => {
        this.fileTable.updateRow(file);
        this.estimates.schedule();
      }),
      appEvents.on('settings-changed', ({ settings }) => {
        this.fileTable.setPreserveBitDepth(settings.preserveBitDepth);
        this.estimates.schedule();
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
    const nextId = appState.neighbourOf(file.id);
    appState.removeFile(file.id);
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
      this.outputLocationEl.textContent = isFileSystemAccessSupported()
        ? 'Output: will download as a ZIP (or choose an output folder)'
        : 'Output: will download as a ZIP — this browser can’t write to folders (Chrome and Edge can)';
    }
  }

  private async handleChooseOutputDirectory(): Promise<void> {
    const handle = await pickWritableDirectory();
    if (!handle) return;
    appState.setOutputRoot(handle);
    this.updateOutputLocation();
  }

  destroy(): void {
    this.estimates.cancel();
    document.removeEventListener('keydown', this.handleKeyDown);
    this.waveformEditor.destroy();
    this.settingsPanel.destroy();
    this.unsubscribers.forEach((u) => u());
  }
}
