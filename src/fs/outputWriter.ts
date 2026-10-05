import { Zip, ZipPassThrough } from 'fflate';
import { ensureReadWrite } from './permissions';

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
    if (!(await ensureReadWrite(this.rootHandle))) {
      throw new Error('Write permission to the output directory was not granted.');
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

/**
 * Streams outputs into a ZIP as they complete, for browsers without FS Access,
 * then offers it as one download. Entries are stored uncompressed — audio
 * barely deflates — and each is appended at write time, so finalize() only
 * writes the central directory: no long main-thread block at the end of a
 * big batch, and no single multi-GB buffer (the Blob is built from chunks).
 */
export class ZipOutputSink implements OutputSink {
  private chunks: Uint8Array[] = [];
  private paths = new Set<string>();
  private error?: Error;
  private zip = new Zip((err, chunk) => {
    if (err) this.error ??= err;
    else this.chunks.push(chunk);
  });
  private downloadName: string;

  constructor(downloadName: string) {
    this.downloadName = downloadName;
  }

  async write(relativePath: string, bytes: Uint8Array): Promise<void> {
    const entry = new ZipPassThrough(uniquePath(relativePath, this.paths));
    this.zip.add(entry);
    entry.push(bytes, true);
    if (this.error) throw this.error;
  }

  async finalize(): Promise<void> {
    if (this.paths.size === 0) return;
    this.zip.end();
    if (this.error) throw this.error;
    const blob = new Blob(this.chunks as Uint8Array<ArrayBuffer>[], { type: 'application/zip' });
    this.chunks = [];
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = this.downloadName;
    anchor.click();
    // Revoking straight away can cancel a large download before it starts (Firefox).
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

/** A path not yet in `taken` (and records it): "a.wav", then "a (2).wav", … — entries can't be replaced once streamed. */
function uniquePath(path: string, taken: Set<string>): string {
  let candidate = path;
  const dot = path.lastIndexOf('.');
  const [stem, ext] = dot > path.lastIndexOf('/') ? [path.slice(0, dot), path.slice(dot)] : [path, ''];
  for (let n = 2; taken.has(candidate); n++) candidate = `${stem} (${n})${ext}`;
  taken.add(candidate);
  return candidate;
}
