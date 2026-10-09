import { describe, it, expect } from 'vitest';
import { unzipSync } from 'fflate';
import { SyncZipWriter, type SyncAccess } from '../../src/fs/opfsZip';

/** In-memory stand-in for a FileSystemSyncAccessHandle: positional writes into a growable file. */
class FakeAccess implements SyncAccess {
  data = new Uint8Array(0);
  flushed = false;
  closed = false;
  write(buffer: AllowSharedBufferSource, options?: FileSystemReadWriteOptions): number {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer as ArrayBuffer);
    const at = options?.at ?? 0;
    if (at + bytes.length > this.data.length) {
      const grown = new Uint8Array(at + bytes.length);
      grown.set(this.data);
      this.data = grown;
    }
    this.data.set(bytes, at);
    return bytes.length;
  }
  flush() {
    this.flushed = true;
  }
  close() {
    this.closed = true;
  }
}

describe('SyncZipWriter', () => {
  it('streams entries into one valid ZIP through positional writes', async () => {
    const access = new FakeAccess();
    const writer = new SyncZipWriter('batch.zip', access);
    await writer.add('kick.wav', new Uint8Array([1, 2, 3]));
    await writer.add('snares/snare.wav', new Uint8Array([4]));
    await writer.end();

    const entries = unzipSync(access.data);
    expect(Object.keys(entries).sort()).toEqual(['kick.wav', 'snares/snare.wav']);
    expect(Array.from(entries['kick.wav'])).toEqual([1, 2, 3]);
    expect(access.flushed && access.closed).toBe(true);
  });

  it('releases the handle even when the archive fails', async () => {
    const access = new FakeAccess();
    access.write = () => {
      throw new Error('quota exceeded');
    };
    const writer = new SyncZipWriter('batch.zip', access);
    // add() resolves once the archive takes the entry; the write failure surfaces at end().
    await writer.add('a.wav', new Uint8Array([1])).catch(() => {});
    await expect(writer.end()).rejects.toThrow('quota exceeded');
    expect(access.closed).toBe(true);
  });
});
