import { useSyncExternalStore } from 'react';

import { parseDecimal, toApiString } from '@/money/decimal';
import { CreateClaimRequest } from '@/types/api';
import { readItem, removeItem, writeItem } from '@/utils/storage';

/**
 * A POST /claims whose outcome we don't know yet, with its Idempotency-Key. Persisted in localStorage so
 * neither leaving the screen nor reloading the page loses the key: retrying with a new key could create
 * a duplicate claim, retrying with the same key never does (API docs).
 */
export type ClaimIntent = { request: CreateClaimRequest; key: string; createdAt: number };

const INTENT_KEY = 'cashmine.unresolvedClaim';

/**
 * The server remembers an Idempotency-Key for 24 h (from the product owner, not in the API docs).
 * After that the same key could create a new claim, so we stop re-sending an hour early
 * to leave room for clock drift and slow requests.
 */
const SAFE_RETRY_WINDOW_MS = 23 * 60 * 60 * 1000;

export function isIntentExpired(intent: ClaimIntent, nowMs: number): boolean {
  return nowMs - intent.createdAt >= SAFE_RETRY_WINDOW_MS;
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function load(): ClaimIntent | null {
  const raw = readItem(INTENT_KEY);
  if (!raw) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) throw new Error('not an object');
    const { asset, amount, destinationId, key, createdAt } = data as Record<string, unknown>;
    const parsedAmount = typeof amount === 'string' ? parseDecimal(amount) : null;
    if (typeof asset !== 'string' || typeof destinationId !== 'string' || typeof key !== 'string' || !parsedAmount) {
      throw new Error('missing fields');
    }
    // Without a valid creation time we can't prove the key is still live, so treat it as expired.
    const created = typeof createdAt === 'number' && Number.isFinite(createdAt) ? createdAt : 0;
    return { request: { asset, amount: parsedAmount, destinationId }, key, createdAt: created };
  } catch {
    removeItem(INTENT_KEY);
    return null;
  }
}

let current: ClaimIntent | null = load();

export function getUnresolvedIntent(): ClaimIntent | null {
  return current;
}

export function setUnresolvedIntent(intent: ClaimIntent | null) {
  current = intent;
  if (intent) {
    const { asset, amount, destinationId } = intent.request;
    writeItem(
      INTENT_KEY,
      JSON.stringify({ asset, amount: toApiString(amount), destinationId, key: intent.key, createdAt: intent.createdAt }),
    );
  } else {
    removeItem(INTENT_KEY);
  }
  listeners.forEach((listener) => listener());
}

export function useUnresolvedIntent(): ClaimIntent | null {
  return useSyncExternalStore(subscribe, getUnresolvedIntent, getUnresolvedIntent);
}

export function sameRequest(a: CreateClaimRequest, b: CreateClaimRequest): boolean {
  return a.asset === b.asset && a.destinationId === b.destinationId && toApiString(a.amount) === toApiString(b.amount);
}
