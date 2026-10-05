import { describe, it, expect } from 'vitest';
import { resolveDroppedItems, walkDirectoryHandle } from '../../src/fs/dragDropEntries';

// Minimal stand-ins for the browser's FileSystemHandle and FileSystemEntry APIs.

type FakeHandle = { kind: 'file'; name: string } | { kind: 'directory'; name: string; values(): AsyncIterable<FakeHandle> };

const fileHandle = (name: string): FakeHandle => ({ kind: 'file', name });
const dirHandle = (name: string, children: FakeHandle[]): FakeHandle => ({
  kind: 'directory',
  name,
  async *values() {
    yield* children;
  },
});

const fileEntry = (name: string) => ({
  name,
  isFile: true,
  isDirectory: false,
  file: (resolve: (file: File) => void) => resolve(new File([], name)),
});

/** readEntries hands children back two at a time, then [] — like Chrome's 100-entry batches. */
const dirEntry = (name: string, children: object[]) => ({
  name,
  isFile: false,
  isDirectory: true,
  createReader: () => {
    let next = 0;
    return {
      readEntries: (resolve: (entries: object[]) => void) => {
        const batch = children.slice(next, next + 2);
        next += 2;
        queueMicrotask(() => resolve(batch)); // the real API calls back asynchronously
      },
    };
  },
});

const asItems = (items: object[]) => items as unknown as DataTransferItemList;
const handleItem = (handle: FakeHandle) => ({ kind: 'file', getAsFileSystemHandle: async () => handle });
const entryItem = (entry: object) => ({ kind: 'file', webkitGetAsEntry: () => entry });

const paths = (entries: Array<{ relativePath: string }>) => entries.map((e) => e.relativePath).sort();

describe('walkDirectoryHandle', () => {
  it('collects supported audio at every depth, keeping handles for overwrite', async () => {
    const root = dirHandle('kit', [
      fileHandle('Kick.WAV'),
      fileHandle('notes.txt'),
      dirHandle('snares', [fileHandle('snare.flac'), dirHandle('deep', [fileHandle('rim.mp3')])]),
    ]);
    const entries = await walkDirectoryHandle(root as unknown as FileSystemDirectoryHandle);
    expect(paths(entries)).toEqual(['kit/Kick.WAV', 'kit/snares/deep/rim.mp3', 'kit/snares/snare.flac']);
    expect(entries.every((e) => e.fileHandle && !e.file)).toBe(true);
  });

  it('skips *_trimmed output folders', async () => {
    const root = dirHandle('kit', [fileHandle('kick.wav'), dirHandle('kit_trimmed', [fileHandle('kick_trimmed_stereo.wav')])]);
    expect(paths(await walkDirectoryHandle(root as unknown as FileSystemDirectoryHandle))).toEqual(['kit/kick.wav']);
  });
});

describe('resolveDroppedItems', () => {
  it('uses a single dropped folder as the root handle', async () => {
    const root = dirHandle('kit', [fileHandle('kick.wav')]);
    const { entries, rootHandle } = await resolveDroppedItems(asItems([handleItem(root)]));
    expect(paths(entries)).toEqual(['kit/kick.wav']);
    expect(rootHandle).toBe(root);
  });

  it('has no root handle when files and folders are dropped together', async () => {
    const { entries, rootHandle } = await resolveDroppedItems(
      asItems([handleItem(dirHandle('kit', [fileHandle('kick.wav')])), handleItem(fileHandle('hat.wav'))]),
    );
    expect(paths(entries)).toEqual(['hat.wav', 'kit/kick.wav']);
    expect(rootHandle).toBeUndefined();
  });

  it('walks webkitGetAsEntry folders across readEntries batches as read-only files', async () => {
    const root = dirEntry('kit', [
      fileEntry('a.wav'),
      fileEntry('b.txt'),
      fileEntry('c.ogg'),
      dirEntry('kit_trimmed', [fileEntry('a_trimmed.wav')]),
      dirEntry('loops', [fileEntry('d.aiff')]),
    ]);
    const { entries, rootHandle } = await resolveDroppedItems(asItems([entryItem(root)]));
    expect(paths(entries)).toEqual(['kit/a.wav', 'kit/c.ogg', 'kit/loops/d.aiff']);
    expect(entries.every((e) => e.file instanceof File && !e.fileHandle)).toBe(true);
    expect(rootHandle).toBeUndefined();
  });

  it('falls back to getAsFile and ignores non-file items', async () => {
    const { entries } = await resolveDroppedItems(
      asItems([{ kind: 'file', getAsFile: () => new File([], 'kick.m4a') }, { kind: 'string' }]),
    );
    expect(paths(entries)).toEqual(['kick.m4a']);
  });
});
