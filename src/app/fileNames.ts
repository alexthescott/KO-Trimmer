export interface SplitName {
  baseName: string;
  /** Lowercased, without the dot; '' when the name has none (or is a dotfile). */
  extension: string;
}

/** Index of the extension's dot in a name or path's last segment; -1 when it has none (or is a dotfile). */
function extensionDot(path: string): number {
  const dot = path.lastIndexOf('.');
  return dot > path.lastIndexOf('/') + 1 ? dot : -1;
}

export function splitNameAndExtension(name: string): SplitName {
  const idx = extensionDot(name);
  if (idx < 0) return { baseName: name, extension: '' };
  return { baseName: name.slice(0, idx), extension: name.slice(idx + 1).toLowerCase() };
}

export function extensionOf(name: string): string {
  return splitNameAndExtension(name).extension;
}

/** Inserts `suffix` before the extension, keeping its case: ("a/Kick.WAV", " (2)") -> "a/Kick (2).WAV". */
export function withSuffixBeforeExtension(path: string, suffix: string): string {
  const idx = extensionDot(path);
  return idx < 0 ? path + suffix : path.slice(0, idx) + suffix + path.slice(idx);
}
