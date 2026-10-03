import type { FavoriteDirectory, FileEntry, ProcessingSettings } from './types';
import { appEvents } from './events';
import { loadSettings, saveSettings } from '../settings/settingsManager';
import { loadFavorites } from '../fs/favoritesStore';

class AppState {
  settings: ProcessingSettings = loadSettings();
  files: FileEntry[] = [];
  favorites: FavoriteDirectory[] = [];
  outputRootHandle?: FileSystemDirectoryHandle;
  outputRootIsOverride = false;
  rootName?: string;

  async init(): Promise<void> {
    this.favorites = await loadFavorites();
    appEvents.emit('favorites-changed', {});
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
    for (const file of this.files) {
      if (file.resultBlobUrl) URL.revokeObjectURL(file.resultBlobUrl);
    }
    this.files = [];
    this.rootName = undefined;
    this.outputRootHandle = undefined;
    this.outputRootIsOverride = false;
    appEvents.emit('files-changed', { files: this.files });
  }

  /** Removes one file and returns the id that should become selected next, if any. */
  removeFile(id: string): string | undefined {
    const idx = this.files.findIndex((f) => f.id === id);
    if (idx < 0) return undefined;
    const removed = this.files[idx];
    if (removed.resultBlobUrl) URL.revokeObjectURL(removed.resultBlobUrl);
    this.files = this.files.filter((f) => f.id !== id);
    appEvents.emit('files-changed', { files: this.files });
    return (this.files[idx] ?? this.files[idx - 1])?.id;
  }

  updateFile(id: string, patch: Partial<FileEntry>): void {
    this.files = this.files.map((f) => (f.id === id ? { ...f, ...patch } : f));
    appEvents.emit('files-changed', { files: this.files });
  }

  updateSettings(patch: Partial<ProcessingSettings>): void {
    this.settings = { ...this.settings, ...patch };
    saveSettings(this.settings);
    appEvents.emit('settings-changed', { settings: this.settings });
  }

  async refreshFavorites(): Promise<void> {
    this.favorites = await loadFavorites();
    appEvents.emit('favorites-changed', {});
  }
}

function fileKey(f: FileEntry): string {
  return f.relativePath + '|' + f.size;
}

export const appState = new AppState();
