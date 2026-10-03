import { h } from '../dom';
import { appState } from '../../app/state';
import { appEvents } from '../../app/events';
import { DropZone } from '../components/DropZone';
import { FavoritesSidebar } from '../components/FavoritesSidebar';
import { SettingsPanel } from '../components/SettingsPanel';
import { FileTable } from '../components/FileTable';
import { PreviewPanel } from './PreviewPanel';
import { pickOutputDirectory } from '../../fs/directoryPicker';
import type { FileEntry } from '../../app/types';

export class MainView {
  element: HTMLElement;
  private fileTable: FileTable;
  private settingsPanel: SettingsPanel;
  private previewPanel: PreviewPanel;
  private outputLocationEl: HTMLElement;
  private processButton: HTMLButtonElement;
  private unsubscribers: Array<() => void> = [];

  constructor(onProcess: () => void) {
    this.previewPanel = new PreviewPanel();
    this.fileTable = new FileTable((file: FileEntry) => this.previewPanel.show(file));
    this.settingsPanel = new SettingsPanel();

    const dropZone = new DropZone();
    const favoritesSidebar = new FavoritesSidebar();

    this.outputLocationEl = h('p', { class: 'muted' });

    this.processButton = h('button', {
      class: 'primary',
      disabled: true,
      onclick: onProcess,
    }, ['Process Files']) as HTMLButtonElement;

    const clearButton = h('button', { onclick: () => appState.clearFiles() }, ['Clear All']);
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

    const actionRow = h('div', { style: 'display:flex; justify-content:flex-end' }, [this.processButton]);

    this.element = h('div', { class: 'layout' }, [
      favoritesSidebar.element,
      h('div', { class: 'main-column' }, [
        filePanel,
        this.settingsPanel.element,
        actionRow,
        this.previewPanel.element,
      ]),
    ]);

    this.unsubscribers.push(
      appEvents.on('files-changed', ({ files }) => {
        this.fileTable.render(files);
        this.settingsPanel.refresh();
        this.processButton.disabled = files.length === 0;
        this.updateOutputLocation();
      }),
    );
  }

  private updateOutputLocation(): void {
    if (appState.files.length === 0) {
      this.outputLocationEl.textContent = '';
      return;
    }
    if (appState.outputRootHandle) {
      this.outputLocationEl.textContent = `Output: ${appState.outputRootHandle.name}/`;
    } else {
      this.outputLocationEl.textContent = 'Output: will download as a ZIP';
    }
  }

  private async handleChooseOutputDirectory(): Promise<void> {
    const handle = await pickOutputDirectory();
    if (!handle) return;
    appState.outputRootHandle = handle;
    appState.outputRootIsOverride = true;
    this.updateOutputLocation();
  }

  destroy(): void {
    this.unsubscribers.forEach((u) => u());
  }
}
