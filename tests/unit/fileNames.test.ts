import { describe, it, expect } from 'vitest';
import { extensionOf, splitNameAndExtension } from '../../src/app/fileNames';
import { chooseOutputFormat, outputContainerFor, outputExtensionFor } from '../../src/audio/outputContainer';
import { canOverwrite } from '../../src/fs/overwriteWriter';
import { FLOAT32, PCM16 } from '../../src/audio/sampleFormat';
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
  it('keeps mp3 as mp3 and AIFF as AIFF, and writes everything else as wav', () => {
    expect(outputContainerFor('mp3')).toBe('mp3');
    for (const ext of ['aif', 'aiff', 'aifc']) expect(outputContainerFor(ext)).toBe('aiff');
    for (const ext of ['wav', 'wave', 'flac', 'm4a', 'ogg', 'opus']) expect(outputContainerFor(ext)).toBe('wav');
  });
  it('keeps .aif/.aiff extensions, writes .aifc as .aif, and normalises the rest', () => {
    expect(['aif', 'aiff', 'aifc', 'wave', 'flac', 'mp3'].map(outputExtensionFor)).toEqual([
      'aif',
      'aiff',
      'aif',
      'wav',
      'wav',
      'mp3',
    ]);
  });
  it('has a PCM sample format only for wav and aiff', () => {
    expect(chooseOutputFormat('wav', undefined, false)).toEqual({ format: PCM16 });
    expect(chooseOutputFormat('aiff', undefined, false)).toEqual({ format: PCM16 });
    expect(chooseOutputFormat('mp3', PCM16, true, 2)).toEqual({});
  });

  it('keeps 32-bit float, with a note, when integer output would clip', () => {
    expect(chooseOutputFormat('wav', FLOAT32, false, 1)).toEqual({ format: PCM16 });
    const clipping = chooseOutputFormat('wav', FLOAT32, false, 1.585);
    expect(clipping.format).toEqual(FLOAT32);
    expect(clipping.clipNote).toBe('Kept 32-bit float — peaks +4.0 dB over full scale would clip at 16-bit');
    expect(chooseOutputFormat('wav', FLOAT32, true, 2)).toEqual({ format: FLOAT32 });
  });
});

describe('canOverwrite', () => {
  const handle = {} as FileSystemFileHandle;
  const entry = (name: string, fileHandle?: FileSystemFileHandle) => ({ name, fileHandle }) as FileEntry;

  it('allows handle-backed sources whose container is kept', () => {
    expect(canOverwrite(entry('a.wav', handle))).toBe(true);
    expect(canOverwrite(entry('a.mp3', handle))).toBe(true);
    expect(canOverwrite(entry('a.aif', handle))).toBe(true);
    expect(canOverwrite(entry('A.AIFF', handle))).toBe(true);
  });
  it('refuses sources re-encoded to another container, or without a handle', () => {
    expect(canOverwrite(entry('a.flac', handle))).toBe(false);
    expect(canOverwrite(entry('a.aifc', handle))).toBe(false); // written as .aif
    expect(canOverwrite(entry('a.wav'))).toBe(false);
  });
});
