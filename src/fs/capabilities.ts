/** Full tier (Chrome): true overwrite, FS-backed output, favorites. Otherwise ZIP download fallback. */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}
