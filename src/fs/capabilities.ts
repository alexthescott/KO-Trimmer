export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export function isDirectoryDragDropSupported(): boolean {
  return typeof DataTransferItem !== 'undefined' && 'getAsFileSystemHandle' in DataTransferItem.prototype;
}

export type CapabilityTier = 'full' | 'degraded';

/** Drives which UI affordances render (true overwrite, favorites, FS-backed output) vs. fallbacks. */
export function getCapabilityTier(): CapabilityTier {
  return isFileSystemAccessSupported() ? 'full' : 'degraded';
}
