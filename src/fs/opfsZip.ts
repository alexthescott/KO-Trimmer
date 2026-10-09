import { ZipStream } from './zipStream';

/** OPFS file names for disk-backed ZIPs; stale ones from earlier batches are deleted at the next batch. */
const DISK_ZIP_PREFIX = 'batch-output-';

/** Deletes ZIPs earlier batches left in the Origin Private File System, then creates this batch's. */
export async function createBatchZipFile(dir: FileSystemDirectoryHandle): Promise<FileSystemFileHandle> {
  for await (const name of dir.keys()) {
    if (name.startsWith(DISK_ZIP_PREFIX)) await dir.removeEntry(name).catch(() => {});
  }
  return dir.getFileHandle(`${DISK_ZIP_PREFIX}${Date.now()}.zip`, { create: true });
}

/** The part of FileSystemSyncAccessHandle the writer uses; a fake in tests. */
export type SyncAccess = Pick<FileSystemSyncAccessHandle, 'write' | 'flush' | 'close'>;

/**
 * A batch ZIP streamed into OPFS through a synchronous access handle — the
 * worker-only API, but the most widely supported way to write OPFS (Safari
 * 15.2+, where FileSystemFileHandle.createWritable may be missing). Runs in
 * zipWriter.worker.ts.
 */
export class SyncZipWriter {
  private zip: ZipStream;
  private offset = 0;

  constructor(
    readonly fileName: string,
    private readonly access: SyncAccess,
  ) {
    this.zip = new ZipStream(
      new WritableStream<Uint8Array>({
        write: (chunk) => {
          this.offset += this.access.write(chunk as Uint8Array<ArrayBuffer>, { at: this.offset });
        },
      }),
    );
  }

  static async open(dir: FileSystemDirectoryHandle): Promise<SyncZipWriter> {
    const handle = await createBatchZipFile(dir);
    return new SyncZipWriter(handle.name, await handle.createSyncAccessHandle());
  }

  add(path: string, bytes: Uint8Array): Promise<void> {
    return this.zip.add(path, bytes);
  }

  /** Finishes the archive and releases the file, so the main thread can read it. */
  async end(): Promise<void> {
    try {
      await this.zip.end();
      this.access.flush();
    } finally {
      this.access.close();
    }
  }
}
