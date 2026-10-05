import { withSuffixBeforeExtension } from '../app/fileNames';

/**
 * Entry paths already used in one archive. A streamed ZIP entry can't be
 * replaced, so a repeated path is numbered instead: "a.wav", "a (2).wav", …
 */
export class ArchivePaths {
  private taken = new Set<string>();

  get isEmpty(): boolean {
    return this.taken.size === 0;
  }

  /** Reserves and returns the first free variant of `path`. */
  claim(path: string): string {
    let candidate = path;
    for (let n = 2; this.taken.has(candidate); n++) candidate = withSuffixBeforeExtension(path, ` (${n})`);
    this.taken.add(candidate);
    return candidate;
  }
}
