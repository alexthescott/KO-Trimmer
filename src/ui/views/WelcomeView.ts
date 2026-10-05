import { h } from '../dom';
import { saveShowWelcome } from '../../settings/settingsManager';

export class WelcomeView {
  element: HTMLElement;

  constructor(onDone: () => void) {
    const showOnStartupCheckbox = h('input', { type: 'checkbox', checked: true });

    const finish = () => {
      saveShowWelcome(showOnStartupCheckbox.checked);
      onDone();
    };

    this.element = h('div', { class: 'modal-overlay' }, [
      h('div', { class: 'modal' }, [
        h('h2', {}, ['Welcome to Sample Trimmer']),
        h('p', {}, [
          'Batch-trim silence from your samples right in the browser — no install, nothing ever leaves your device. Built for sample-limited hardware like the OP-1/OP-Z, Pocket Operators, and MPC.',
        ]),
        h('ol', {}, [
          h('li', {}, ['Drop audio files or a folder, or click to choose a folder.']),
          h('li', {}, ['Adjust silence threshold, padding, mono/stereo, bitrate, and speed-up.']),
          h('li', {}, ['Click Process Files and watch live progress.']),
          h('li', {}, ['Preview the original vs. trimmed result before you use it.']),
        ]),
        h('div', { class: 'checkbox-row' }, [
          showOnStartupCheckbox,
          h('label', {}, ['Show this on startup']),
        ]),
        h('div', { style: 'display:flex; justify-content:flex-end; gap:8px; margin-top:16px' }, [
          h('button', { onclick: finish }, ['Skip for now']),
          h('button', { class: 'primary', onclick: finish }, ['Get Started!']),
        ]),
      ]),
    ]);
  }
}
