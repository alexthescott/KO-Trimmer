/** Display formatting for sizes, counts and durations. */

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

/** Size change as a signed percentage: "−42%" when smaller, "+5%" when larger. */
export function formatSizeChange(originalBytes: number, newBytes: number): string {
  const pct = Math.round((1 - newBytes / Math.max(1, originalBytes)) * 100);
  return `${pct >= 0 ? '−' : '+'}${Math.abs(pct)}%`;
}

/** "1 file", "3 files". */
export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function formatDuration(seconds: number): string {
  return `${seconds.toFixed(2)}s`;
}
