import { h } from '../dom';
import { appState } from '../../app/state';
import { appEvents } from '../../app/events';
import { addFavorite, removeFavorite, ensureFavoritePermission } from '../../fs/favoritesStore';
import { walkDirectoryHandle } from '../../fs/dragDropEntries';
import { resolveDefaultOutputRoot } from '../../fs/directoryPicker';
import { toFileEntries, deriveRootName } from '../../app/fileEntries';
import { isFileSystemAccessSupported } from '../../fs/capabilities';
import type { FavoriteDirectory } from '../../app/types';

export class FavoritesSidebar {
  element: HTMLElement;
  private unsubscribe: () => void;

  constructor() {
    this.element = h('div', { class: 'panel sidebar' });
    this.unsubscribe = appEvents.on('favorites-changed', () => this.render());
    this.render();
  }

  destroy(): void {
    this.unsubscribe();
  }

  private render(): void {
    if (appState.favorites.length === 0 && !isFileSystemAccessSupported()) {
      this.element.replaceChildren();
      this.element.style.display = 'none';
      return;
    }
    this.element.style.display = '';

    const items = appState.favorites.map((fav) => this.renderFavoriteItem(fav));
    const addButton = h('button', { onclick: () => this.handleAddFavorite() }, ['+ Add Favorite Directory']);

    this.element.replaceChildren(
      h('h3', {}, ['Favorites']),
      h('ul', { class: 'favorites-list' }, items),
      addButton,
    );
  }

  private renderFavoriteItem(fav: FavoriteDirectory): HTMLElement {
    const removeBtn = h('button', {
      onclick: (e: Event) => {
        e.stopPropagation();
        removeFavorite(fav.id).then(() => appState.refreshFavorites());
      },
    }, ['×']);

    const li = h('li', {}, [h('span', {}, [fav.displayName]), removeBtn]);
    li.addEventListener('click', () => this.handleSelectFavorite(fav));
    return li;
  }

  private async handleAddFavorite(): Promise<void> {
    if (!isFileSystemAccessSupported()) return;
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      await addFavorite(handle.name, handle);
      await appState.refreshFavorites();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      throw err;
    }
  }

  private async handleSelectFavorite(fav: FavoriteDirectory): Promise<void> {
    const granted = await ensureFavoritePermission(fav);
    if (!granted) return;
    const entries = await walkDirectoryHandle(fav.handle);
    if (!appState.outputRootIsOverride) {
      appState.outputRootHandle = await resolveDefaultOutputRoot(fav.handle, fav.handle.name);
    }
    appState.rootName = deriveRootName(entries) ?? fav.displayName;
    const fileEntries = await toFileEntries(entries);
    appState.setFiles(fileEntries);
  }
}
