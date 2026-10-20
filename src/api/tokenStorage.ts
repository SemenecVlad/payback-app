const TOKEN_KEY = 'cashmine.token';

// localStorage can be missing (tests, SSR) or throw (private mode); treat that as "no token".
function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  try {
    return storage()?.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function setToken(token: string): boolean {
  try {
    const store = storage();
    if (!store) return false;
    store.setItem(TOKEN_KEY, token);
    return true;
  } catch {
    return false;
  }
}

export function clearToken(): void {
  try {
    storage()?.removeItem(TOKEN_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
