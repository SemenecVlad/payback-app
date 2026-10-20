import { readItem, removeItem, writeItem } from '@/utils/storage';

const TOKEN_KEY = 'cashmine.token';

export function getToken(): string | null {
  return readItem(TOKEN_KEY) || null;
}

export function setToken(token: string): boolean {
  return writeItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  removeItem(TOKEN_KEY);
}
