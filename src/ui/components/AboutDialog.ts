import { h } from '../dom';
import { loadWelcomeOptIn, saveShowWelcome } from '../../settings/settingsManager';

/** Opens the About modal; closes on the Close button, Escape, or a backdrop click. */
export function openAboutDialog(): void {
  const close = () => {
    document.removeEventListener('keydown', onKeyDown);
    overlay.remove();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };

  const closeButton = h('button', { class: 'primary', onclick: close }, ['Close']);
  const showWelcomeCheckbox = h('input', {
    type: 'checkbox',
    id: 'about-show-welcome',
    checked: loadWelcomeOptIn(),
    onchange: () => saveShowWelcome(showWelcomeCheckbox.checked),
  });

  const overlay = h(
    'div',
    {
      class: 'modal-overlay',
      onclick: (e: Event) => {
        if (e.target === overlay) close();
      },
    },
    [
      h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'about-title' }, [
        h('h2', { id: 'about-title' }, ['About Sample Trimmer']),
        h('p', {}, [
          'Sample Trimmer batch-trims silence from the start and end of your samples, so more of them fit on ' +
            'sample-limited hardware like the OP-1/OP-Z, EP series, Pocket Operators, and MPC.',
        ]),
        h('p', {}, [
          'Beyond trimming, it can shrink files further with a mono downmix, bitrate/sample-rate reduction, and ' +
            'tape-style speed-up. Check and adjust each trim in the waveform editor before processing.',
        ]),
        h('p', {}, [
          h('strong', {}, ['Runs entirely in your browser — nothing is uploaded.']),
          ' Decoding, trimming, and encoding all happen on your device, and the app works offline once installed.',
        ]),
        h('p', { class: 'muted' }, [
          'MP3 inputs stay MP3 and AIFF stays AIFF; everything else is written as WAV — 16-bit unless Preserve Bit Depth is on, or ' +
            'unless a float source peaks over full scale, which stays 32-bit float rather than clipping. ' +
            'Files longer than 20 seconds after ' +
            'processing get a "_" prefix for KO II compatibility.',
        ]),
        h('div', { class: 'checkbox-row' }, [
          showWelcomeCheckbox,
          h('label', { for: 'about-show-welcome' }, ['Show the welcome screen every time the app opens']),
        ]),
        h('div', { style: 'display:flex; justify-content:flex-end; margin-top:16px' }, [closeButton]),
      ]),
    ],
  );

  document.addEventListener('keydown', onKeyDown);
  document.body.append(overlay);
  closeButton.focus();
}

export function renderAboutButton(): HTMLElement {
  return h('button', { class: 'about-button', onclick: openAboutDialog }, ['About']);
}
