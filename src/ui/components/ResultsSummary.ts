import { h, formatBytes } from '../dom';
import type { BatchSummary } from '../../app/processBatch';

/**
 * A single consolidated "done" surface: results, errors, and KO-II
 * warnings in one place.
 */
export function renderResultsSummary(
  summary: BatchSummary,
  outputDescription: string,
): HTMLElement {
  const reduction =
    summary.originalBytes > 0
      ? Math.round((1 - summary.outputBytes / summary.originalBytes) * 100)
      : 0;

  const rows: HTMLElement[] = [
    h('p', {}, [`Processed: ${summary.processedCount}`]),
  ];
  if (summary.skippedCount > 0) rows.push(h('p', {}, [`Skipped: ${summary.skippedCount}`]));
  if (summary.errorCount > 0) {
    rows.push(h('p', { style: 'color:var(--danger)' }, [`Failed: ${summary.errorCount}`]));
  }
  if (summary.originalBytes > 0) {
    rows.push(
      h('p', {}, [
        `${formatBytes(summary.originalBytes)} → ${formatBytes(summary.outputBytes)} (${
          reduction >= 0 ? '−' : '+'
        }${Math.abs(reduction)}%)`,
      ]),
    );
  }
  rows.push(h('p', { class: 'muted' }, [outputDescription]));

  if (summary.longerThan20sNames.length > 0) {
    rows.push(
      h('div', { style: 'color:var(--warning)' }, [
        h('p', {}, [
          `${summary.longerThan20sNames.length} file(s) are still over 20s — saved with a leading underscore for KO II sorting:`,
        ]),
        h('ul', {}, summary.longerThan20sNames.map((name) => h('li', {}, [name]))),
      ]),
    );
  }

  if (summary.aborted) {
    rows.unshift(h('p', { style: 'color:var(--warning)' }, ['Processing was stopped before all files finished.']));
  }

  return h('div', { class: 'panel' }, [h('h3', {}, ['Results']), ...rows]);
}
