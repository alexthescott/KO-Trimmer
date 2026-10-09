import { h } from '../dom';
import { resolveDroppedItems, SUPPORTED_EXTENSIONS, type DroppedEntry } from '../../fs/dragDropEntries';
import { pickDirectory, pickFiles } from '../../fs/directoryPicker';
import { isFileSystemAccessSupported } from '../../fs/capabilities';
import { toFileEntries, deriveRootName } from '../../app/fileEntries';
import { appState } from '../../app/state';

/** `accept` for the file input: extensions as well as audio/*, since .aif etc. often lack a MIME type. */
const ACCEPT = ['audio/*', ...SUPPORTED_EXTENSIONS.map((ext) => `.${ext}`)].join(',');

export class DropZone {
  element: HTMLElement;
  private folderInput: HTMLInputElement;
  private filesInput: HTMLInputElement;

  constructor() {
    const chooseFilesButton = h(
      'button',
      {
        type: 'button',
        onclick: (e: Event) => {
          e.stopPropagation();
          void this.handleChooseFiles();
        },
      },
      ['Choose files…'],
    );

    const zone = h('div', { class: 'drop-zone', tabindex: '0', role: 'button' }, [
      h('p', {}, ['Drop audio files or folders here, or click to choose a folder.']),
      h('p', { class: 'muted' }, [SUPPORTED_EXTENSIONS.map((ext) => `.${ext}`).join(' ')]),
      chooseFilesButton,
    ]);

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      if (e.dataTransfer) void this.handleDrop(e.dataTransfer.items);
    });
    zone.addEventListener('click', () => void this.handleClick());
    zone.addEventListener('keydown', (e) => {
      if (e.target !== zone || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      e.stopPropagation(); // else MainView's Space shortcut also starts playback
      void this.handleClick();
    });

    this.folderInput = this.hiddenInput({ webkitdirectory: true });
    // No folder picking on iOS, so plain multi-file selection must always be available.
    this.filesInput = this.hiddenInput({ accept: ACCEPT });

    this.element = h('div', {}, [zone, this.folderInput, this.filesInput]);
  }

  private hiddenInput(attrs: Record<string, string | boolean>): HTMLInputElement {
    const input = h('input', { type: 'file', multiple: true, style: 'display:none', ...attrs });
    input.addEventListener('change', () => {
      const entries = Array.from(input.files ?? [], (file) => ({
        name: file.name,
        relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
        file,
      }));
      input.value = '';
      void this.addEntries(entries);
    });
    return input;
  }

  private async handleDrop(items: DataTransferItemList): Promise<void> {
    const { entries, rootHandle } = await resolveDroppedItems(items);
    if (rootHandle) appState.useSourceRoot(rootHandle);
    await this.addEntries(entries);
  }

  private async handleClick(): Promise<void> {
    if (isFileSystemAccessSupported()) {
      const picked = await pickDirectory();
      if (picked) {
        appState.useSourceRoot(picked.handle);
        await this.addEntries(picked.entries);
      }
      return;
    }
    this.folderInput.click();
  }

  /** The native picker where available (keeps handles for Overwrite), else the file input. */
  private async handleChooseFiles(): Promise<void> {
    if (!('showOpenFilePicker' in window)) {
      this.filesInput.click();
      return;
    }
    const entries = await pickFiles();
    if (entries) await this.addEntries(entries);
  }

  private async addEntries(entries: DroppedEntry[]): Promise<void> {
    if (entries.length === 0) return;
    appState.adoptRootName(deriveRootName(entries));
    const fileEntries = await toFileEntries(entries);
    appState.addFiles(fileEntries);
  }
}
