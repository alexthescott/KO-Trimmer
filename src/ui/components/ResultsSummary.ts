import { h, formatBytes, formatSizeChange, plural } from '../dom';
import { KO_II_MAX_DURATION_SEC } from '../../audio/naming';
import type { BatchSummary } from '../../app/processBatch';

/**
 * A single consolidated "done" surface: results, errors, and KO-II
 * warnings in one place.
 */
export function renderResultsSummary(
  summary: BatchSummary,
  outputDescription: string,
): HTMLElement {
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
        `${formatBytes(summary.originalBytes)} → ${formatBytes(summary.outputBytes)} ` +
          `(${formatSizeChange(summary.originalBytes, summary.outputBytes)})`,
      ]),
    );
  }
  for (const [conversion, count] of Object.entries(summary.formatConversions)) {
    rows.push(h('p', {}, [`${plural(count, 'file')} converted ${conversion}`]));
  }
  rows.push(h('p', { class: 'muted' }, [outputDescription]));

  const overLength = summary.overKoIILengthNames;
  if (overLength.length > 0) {
    rows.push(
      h('div', { style: 'color:var(--warning)' }, [
        h('p', {}, [
          `${plural(overLength.length, 'file')} still over ${KO_II_MAX_DURATION_SEC}s — saved with a leading underscore for KO II sorting:`,
        ]),
        h('ul', {}, overLength.map((name) => h('li', {}, [name]))),
      ]),
    );
  }

  if (summary.aborted) {
    rows.unshift(h('p', { style: 'color:var(--warning)' }, ['Processing was stopped before all files finished.']));
  }

  return h('div', { class: 'panel' }, [h('h3', {}, ['Results']), ...rows]);
}
