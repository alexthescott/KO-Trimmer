// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { FileTable } from '../../src/ui/components/FileTable';
import type { FileEntry } from '../../src/app/types';

const entry = (id: string): FileEntry => ({
  id,
  name: `${id}.wav`,
  relativePath: `${id}.wav`,
  size: 1000,
  file: new File([], `${id}.wav`),
  status: 'queued',
});

function setup() {
  const onSelect = vi.fn();
  const table = new FileTable({ onSelect, preserveBitDepth: false });
  table.render(['a', 'b', 'c'].map(entry));
  const rows = () => Array.from(table.element.querySelectorAll('tbody tr'));
  return { table, onSelect, rows };
}

describe('FileTable selection', () => {
  it('highlights exactly the selected row and notifies onSelect', () => {
    const { table, onSelect, rows } = setup();
    table.select('b');
    expect(rows().map((r) => r.classList.contains('selected'))).toEqual([false, true, false]);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));
    table.select('c');
    expect(rows().map((r) => r.classList.contains('selected'))).toEqual([false, false, true]);
  });

  it('moves the highlight without rebuilding rows', () => {
    const { table, rows } = setup();
    const before = rows();
    table.select('a');
    table.selectAdjacent(1);
    expect(table.selectedId).toBe('b');
    expect(rows()).toEqual(before);
  });

  it('clears the highlight when selectedId is set to null, without calling onSelect', () => {
    const { table, onSelect, rows } = setup();
    table.select('a');
    onSelect.mockClear();
    table.selectedId = null;
    expect(rows().some((r) => r.classList.contains('selected'))).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('keeps the selection across a re-render', () => {
    const { table, rows } = setup();
    table.select('c');
    table.render(['a', 'b', 'c'].map(entry));
    expect(rows()[2].classList.contains('selected')).toBe(true);
  });
});
