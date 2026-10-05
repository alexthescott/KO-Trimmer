export interface SplitName {
  baseName: string;
  /** Lowercased, without the dot; '' when the name has none (or is a dotfile). */
  extension: string;
}

export function splitNameAndExtension(name: string): SplitName {
  const idx = name.lastIndexOf('.');
  if (idx <= 0) return { baseName: name, extension: '' };
  return { baseName: name.slice(0, idx), extension: name.slice(idx + 1).toLowerCase() };
}

export function extensionOf(name: string): string {
  return splitNameAndExtension(name).extension;
}
