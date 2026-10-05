import { describe, it, expect } from 'vitest';
import { ArchivePaths } from '../../src/fs/archivePaths';
import { withSuffixBeforeExtension } from '../../src/app/fileNames';

describe('ArchivePaths', () => {
  it('numbers repeated paths before the extension', () => {
    const paths = new ArchivePaths();
    expect(paths.isEmpty).toBe(true);
    expect(paths.claim('kit/kick.wav')).toBe('kit/kick.wav');
    expect(paths.claim('kit/kick.wav')).toBe('kit/kick (2).wav');
    expect(paths.claim('kit/kick.wav')).toBe('kit/kick (3).wav');
    expect(paths.claim('other/kick.wav')).toBe('other/kick.wav');
    expect(paths.isEmpty).toBe(false);
  });

  it('skips a numbered name that is already taken', () => {
    const paths = new ArchivePaths();
    paths.claim('a (2).wav');
    paths.claim('a.wav');
    expect(paths.claim('a.wav')).toBe('a (3).wav');
  });
});

describe('withSuffixBeforeExtension', () => {
  it('keeps the extension case and ignores dots in folder names', () => {
    expect(withSuffixBeforeExtension('Kick.01.WAV', ' (2)')).toBe('Kick.01 (2).WAV');
    expect(withSuffixBeforeExtension('v1.2/kick', ' (2)')).toBe('v1.2/kick (2)');
    expect(withSuffixBeforeExtension('dir/.hidden', ' (2)')).toBe('dir/.hidden (2)');
  });
});
