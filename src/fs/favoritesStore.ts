import { get, set, del, keys } from 'idb-keyval';
import type { FavoriteDirectory } from '../app/types';
import { pickWritableDirectory } from './directoryPicker';

const PREFIX = 'koTrimmer.favorite.';

/**
 * FileSystemDirectoryHandles are structured-clone-storable, so they persist
 * in IndexedDB (not localStorage, which can't hold them).
 */
export async function loadFavorites(): Promise<FavoriteDirectory[]> {
  const allKeys = await keys();
  const favoriteKeys = allKeys.filter((k) => typeof k === 'string' && k.startsWith(PREFIX));
  const favorites: FavoriteDirectory[] = [];
  for (const key of favoriteKeys) {
    const value = await get(key as string);
    if (value) favorites.push(value as FavoriteDirectory);
  }
  return favorites;
}

/** Prompts for a directory and stores it as a favorite; null if the user cancels. */
export async function pickAndAddFavorite(): Promise<FavoriteDirectory | null> {
  const handle = await pickWritableDirectory();
  if (!handle) return null;
  const favorite: FavoriteDirectory = { id: crypto.randomUUID(), displayName: handle.name, handle };
  await set(PREFIX + favorite.id, favorite);
  return favorite;
}

export async function removeFavorite(id: string): Promise<void> {
  await del(PREFIX + id);
}

