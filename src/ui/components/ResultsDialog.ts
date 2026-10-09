import { h } from '../dom';
import { renderResultsSummary } from './ResultsSummary';
import type { BatchSummary } from '../../app/processBatch';

/** Opens the batch results modal; `onDismiss` runs once on the Close button, Escape, or a backdrop click. */
export function openResultsDialog(summary: BatchSummary, outputDescription: string, onDismiss: () => void): void {
  const close = () => {
    document.removeEventListener('keydown', onKeyDown);
    overlay.remove();
    onDismiss();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };

  const closeButton = h('button', { class: 'primary', onclick: close }, ['Close']);
  const overlay = h(
    'div',
    {
      class: 'modal-overlay',
      onclick: (e: Event) => {
        if (e.target === overlay) close();
      },
    },
    [
      h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'results-title' }, [
        h('h2', { id: 'results-title' }, ['Results']),
        renderResultsSummary(summary, outputDescription),
        h('div', { style: 'display:flex; justify-content:flex-end; margin-top:16px' }, [closeButton]),
      ]),
    ],
  );

  document.addEventListener('keydown', onKeyDown);
  document.body.append(overlay);
  closeButton.focus();
}
