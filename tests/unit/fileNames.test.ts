import { describe, it, expect } from 'vitest';
import { extensionOf, splitNameAndExtension } from '../../src/app/fileNames';
import { outputContainerFor, outputSampleFormat } from '../../src/audio/outputContainer';
import { canOverwrite } from '../../src/fs/overwriteWriter';
import { PCM16 } from '../../src/audio/sampleFormat';
import type { FileEntry } from '../../src/app/types';

describe('splitNameAndExtension', () => {
  it('splits on the last dot and lowercases the extension', () => {
    expect(splitNameAndExtension('Kick.01.WAV')).toEqual({ baseName: 'Kick.01', extension: 'wav' });
  });
  it('treats dotless names and dotfiles as having no extension', () => {
    expect(splitNameAndExtension('README')).toEqual({ baseName: 'README', extension: '' });
    expect(extensionOf('.wav')).toBe('');
  });
});

describe('outputContainerFor', () => {
  it('keeps mp3 as mp3 and writes everything else as wav', () => {
    expect(outputContainerFor('mp3')).toBe('mp3');
    for (const ext of ['wav', 'flac', 'aiff', 'm4a', 'ogg']) expect(outputContainerFor(ext)).toBe('wav');
  });
  it('has a PCM sample format only for wav', () => {
    expect(outputSampleFormat('wav', undefined, false)).toEqual(PCM16);
    expect(outputSampleFormat('mp3', PCM16, true)).toBeUndefined();
  });
});

describe('canOverwrite', () => {
  const handle = {} as FileSystemFileHandle;
  const entry = (name: string, fileHandle?: FileSystemFileHandle) => ({ name, fileHandle }) as FileEntry;

  it('allows handle-backed sources whose container is kept', () => {
    expect(canOverwrite(entry('a.wav', handle))).toBe(true);
    expect(canOverwrite(entry('a.mp3', handle))).toBe(true);
  });
  it('refuses sources re-encoded to another container, or without a handle', () => {
    expect(canOverwrite(entry('a.flac', handle))).toBe(false);
    expect(canOverwrite(entry('a.wav'))).toBe(false);
  });
});
