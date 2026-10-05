import type { FileEntry, ProcessingSettings } from './types';

export interface AppEventMap {
  'files-changed': { files: FileEntry[] };
  'settings-changed': { settings: ProcessingSettings };
  'favorites-changed': {};
}

/** Tiny typed pub/sub so UI modules stay decoupled without a framework. */
export class AppEvents extends EventTarget {
  emit<K extends keyof AppEventMap>(type: K, detail: AppEventMap[K]): void {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  on<K extends keyof AppEventMap>(type: K, handler: (detail: AppEventMap[K]) => void): () => void {
    const listener = (event: Event) => handler((event as CustomEvent<AppEventMap[K]>).detail);
    this.addEventListener(type, listener);
    return () => this.removeEventListener(type, listener);
  }
}

export const appEvents = new AppEvents();
