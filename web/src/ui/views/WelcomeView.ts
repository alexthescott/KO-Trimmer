import { h } from '../dom';
import { saveShowWelcome } from '../../settings/settingsManager';
import { isFileSystemAccessSupported } from '../../fs/capabilities';
import { addFavorite } from '../../fs/favoritesStore';
import { appState } from '../../app/state';

export class WelcomeView {
  element: HTMLElement;

  constructor(onDone: () => void) {
    const showOnStartupCheckbox = h('input', { type: 'checkbox', checked: true }) as HTMLInputElement;

    const addFavoriteButton = h('button', {
      onclick: async () => {
        if (!isFileSystemAccessSupported()) return;
        try {
          const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
          await addFavorite(handle.name, handle);
          await appState.refreshFavorites();
        } catch (err) {
          if (!(err instanceof DOMException && err.name === 'AbortError')) throw err;
        }
      },
    }, ['+ Add Favorite Directory']);

    const finish = () => {
      saveShowWelcome(showOnStartupCheckbox.checked);
      onDone();
    };

    this.element = h('div', { class: 'modal-overlay' }, [
      h('div', { class: 'modal' }, [
        h('h2', {}, ['Welcome to KO Trimmer']),
        h('p', {}, [
          'Batch-trim silence from your samples right in the browser — no install, nothing ever leaves your device. Built for sample-limited hardware like the OP-1/OP-Z, Pocket Operators, and MPC.',
        ]),
        h('ol', {}, [
          h('li', {}, ['Drop audio files or a folder, or pick a favorite directory.']),
          h('li', {}, ['Adjust silence threshold, padding, mono/stereo, bitrate, and speed-up.']),
          h('li', {}, ['Click Process Files and watch live progress.']),
          h('li', {}, ['Preview the original vs. trimmed result before you use it.']),
        ]),
        isFileSystemAccessSupported()
          ? h('p', {}, [addFavoriteButton])
          : h('p', { class: 'muted' }, ['(Favorite directories need Chrome\'s folder access support.)']),
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
