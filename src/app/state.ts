import type { FileEntry, ProcessingSettings } from './types';
import { appEvents } from './events';
import { loadSettings, saveSettings } from '../settings/settingsManager';
import { defaultOutputFolderName, resolveDefaultOutputRoot } from '../fs/directoryPicker';
import { ensureReadWrite } from '../fs/permissions';

class AppState {
  settings: ProcessingSettings = loadSettings();
  files: FileEntry[] = [];
  /** Where the current run writes outputs (set by prepareOutputRoot); undefined means ZIP download. */
  outputRootHandle?: FileSystemDirectoryHandle;
  /** Picked/dropped source folder; its `<name>_trimmed` subfolder is the default output. */
  private sourceRootHandle?: FileSystemDirectoryHandle;
  /** Explicit "Choose output folder…" — sticks until Clear All. */
  private outputRootOverride?: FileSystemDirectoryHandle;
  private batchRootName?: string;

  /** Root folder name of the batch, for naming the ZIP. */
  get rootName(): string | undefined {
    return this.batchRootName;
  }

  /** The first add of a batch names it; later adds keep that name. */
  adoptRootName(name: string | undefined): void {
    this.batchRootName ??= name;
  }

  setFiles(files: FileEntry[]): void {
    this.files = files;
    appEvents.emit('files-changed', { files: this.files });
  }

  addFiles(newFiles: FileEntry[]): void {
    const existingKeys = new Set(this.files.map(fileKey));
    const deduped = newFiles.filter((f) => !existingKeys.has(fileKey(f)));
    this.files = [...this.files, ...deduped];
    appEvents.emit('files-changed', { files: this.files });
  }

  clearFiles(): void {
    this.files = [];
    this.batchRootName = undefined;
    this.outputRootHandle = undefined;
    this.sourceRootHandle = undefined;
    this.outputRootOverride = undefined;
    appEvents.emit('files-changed', { files: this.files });
  }

  /** The file that takes `id`'s place in the list once it's removed: the next one, else the previous. */
  neighbourOf(id: string): string | undefined {
    const idx = this.files.findIndex((f) => f.id === id);
    if (idx < 0) return undefined;
    return (this.files[idx + 1] ?? this.files[idx - 1])?.id;
  }

  removeFile(id: string): void {
    if (!this.files.some((f) => f.id === id)) return;
    this.files = this.files.filter((f) => f.id !== id);
    appEvents.emit('files-changed', { files: this.files });
  }

  updateFile(id: string, patch: Partial<FileEntry>): void {
    const idx = this.files.findIndex((f) => f.id === id);
    if (idx < 0) return;
    const file = { ...this.files[idx], ...patch };
    this.files = this.files.slice();
    this.files[idx] = file;
    appEvents.emit('file-updated', { file });
  }

  updateSettings(patch: Partial<ProcessingSettings>): void {
    this.settings = { ...this.settings, ...patch };
    saveSettings(this.settings);
    appEvents.emit('settings-changed', { settings: this.settings });
  }

  /** A directory was opened as the source: default output goes inside it, unless the user chose one. */
  /**
   * Remembers the source root without touching disk: a dropped folder's handle
   * is read-only until permission is requested, which needs a user gesture.
   */
  useSourceRoot(handle: FileSystemDirectoryHandle): void {
    this.sourceRootHandle = handle;
  }

  setOutputRoot(handle: FileSystemDirectoryHandle): void {
    this.outputRootOverride = handle;
  }

  /** Folder name outputs will be written to, or undefined for a ZIP download. */
  get outputFolderName(): string | undefined {
    if (this.outputRootOverride) return this.outputRootOverride.name;
    return this.sourceRootHandle && defaultOutputFolderName(this.sourceRootHandle);
  }

  /**
   * Resolves outputRootHandle for a run, creating the default `_trimmed`
   * folder. Call from a user gesture (may prompt for write permission);
   * falls back to ZIP download if permission is refused.
   */
  async prepareOutputRoot(): Promise<void> {
    this.outputRootHandle = undefined;
    const target = this.outputRootOverride ?? this.sourceRootHandle;
    if (!target) return;
    try {
      if (!(await ensureReadWrite(target))) return;
      this.outputRootHandle = this.outputRootOverride ?? (await resolveDefaultOutputRoot(target));
    } catch (err) {
      console.warn('Output folder unavailable; falling back to ZIP download.', err);
    }
  }
}

function fileKey(f: FileEntry): string {
  return f.relativePath + '|' + f.size;
}

export const appState = new AppState();
