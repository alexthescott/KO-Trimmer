import { zipSync } from 'fflate';

export interface OutputSink {
  write(relativePath: string, bytes: Uint8Array): Promise<void>;
  finalize(): Promise<void>;
}

/** Writes outputs into a directory tree via the File System Access API. */
export class FsAccessOutputSink implements OutputSink {
  private rootHandle: FileSystemDirectoryHandle;
  private permissionChecked = false;

  constructor(rootHandle: FileSystemDirectoryHandle) {
    this.rootHandle = rootHandle;
  }

  private async ensurePermission(): Promise<void> {
    if (this.permissionChecked) return;
    const granted = await this.rootHandle.queryPermission({ mode: 'readwrite' });
    if (granted !== 'granted') {
      const result = await this.rootHandle.requestPermission({ mode: 'readwrite' });
      if (result !== 'granted') {
        throw new Error('Write permission to the output directory was not granted.');
      }
    }
    this.permissionChecked = true;
  }

  async write(relativePath: string, bytes: Uint8Array): Promise<void> {
    await this.ensurePermission();
    const parts = relativePath.split('/').filter(Boolean);
    const fileName = parts.pop()!;
    let dir = this.rootHandle;
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create: true });
    }
    const fileHandle = await dir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(bytes as Uint8Array<ArrayBuffer>);
    await writable.close();
  }

  async finalize(): Promise<void> {
    // no-op: files are written as they complete
  }
}

/** Accumulates outputs in memory and offers a single ZIP download, for browsers without FS Access. */
export class ZipOutputSink implements OutputSink {
  private entries: Record<string, Uint8Array> = {};
  private downloadName: string;

  constructor(downloadName: string) {
    this.downloadName = downloadName;
  }

  async write(relativePath: string, bytes: Uint8Array): Promise<void> {
    this.entries[relativePath] = bytes;
  }

  async finalize(): Promise<void> {
    if (Object.keys(this.entries).length === 0) return;
    const zipped = zipSync(this.entries);
    const blob = new Blob([zipped], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = this.downloadName;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
