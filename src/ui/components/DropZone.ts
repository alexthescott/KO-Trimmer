import { h } from '../dom';
import { resolveDroppedItems, type DroppedEntry } from '../../fs/dragDropEntries';
import { pickDirectory } from '../../fs/directoryPicker';
import { isFileSystemAccessSupported } from '../../fs/capabilities';
import { toFileEntries, deriveRootName } from '../../app/fileEntries';
import { appState } from '../../app/state';

export class DropZone {
  element: HTMLElement;
  private fallbackInput: HTMLInputElement;

  constructor() {
    const zone = h('div', { class: 'drop-zone', tabindex: '0' }, [
      h('p', {}, ['Drop audio files or folders here, or click to choose a folder.']),
      h('p', { class: 'muted' }, ['.wav .mp3 .flac .aiff .m4a .ogg']),
    ]);

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', async (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const dataTransfer = (e as DragEvent).dataTransfer;
      if (!dataTransfer) return;
      const { entries, rootHandle } = await resolveDroppedItems(dataTransfer.items);
      if (rootHandle) appState.useSourceRoot(rootHandle);
      await this.addEntries(entries);
    });
    zone.addEventListener('click', () => this.handleClick());

    this.fallbackInput = h('input', {
      type: 'file',
      multiple: true,
      webkitdirectory: true,
      style: 'display:none',
    });
    this.fallbackInput.addEventListener('change', async () => {
      const files = Array.from(this.fallbackInput.files ?? []);
      const entries = files.map((file) => ({
        name: file.name,
        relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
        file,
      }));
      await this.addEntries(entries);
      this.fallbackInput.value = '';
    });

    this.element = h('div', {}, [zone, this.fallbackInput]);
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
    this.fallbackInput.click();
  }

  private async addEntries(entries: DroppedEntry[]): Promise<void> {
    if (entries.length === 0) return;
    appState.adoptRootName(deriveRootName(entries));
    const fileEntries = await toFileEntries(entries);
    appState.addFiles(fileEntries);
  }
}
