import { get, set, del, keys } from 'idb-keyval';
import type { FavoriteDirectory } from '../app/types';

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

export async function addFavorite(displayName: string, handle: FileSystemDirectoryHandle): Promise<FavoriteDirectory> {
  const favorite: FavoriteDirectory = { id: crypto.randomUUID(), displayName, handle };
  await set(PREFIX + favorite.id, favorite);
  return favorite;
}

export async function removeFavorite(id: string): Promise<void> {
  await del(PREFIX + id);
}

export async function renameFavorite(favorite: FavoriteDirectory, displayName: string): Promise<FavoriteDirectory> {
  const updated = { ...favorite, displayName };
  await set(PREFIX + favorite.id, updated);
  return updated;
}

/** Re-requests permission on reuse (user-gesture required), per File System Access API rules. */
export async function ensureFavoritePermission(favorite: FavoriteDirectory): Promise<boolean> {
  const granted = await favorite.handle.queryPermission({ mode: 'readwrite' });
  if (granted === 'granted') return true;
  const result = await favorite.handle.requestPermission({ mode: 'readwrite' });
  return result === 'granted';
}
