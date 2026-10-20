// localStorage can be missing (tests, SSR) or throw (private mode, blocked site data); every access is guarded.
function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function readItem(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeItem(key: string, value: string): boolean {
  try {
    const store = storage();
    if (!store) return false;
    store.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeItem(key: string): void {
  try {
    storage()?.removeItem(key);
  } catch {
    // Nothing to remove if storage is unavailable.
  }
}
