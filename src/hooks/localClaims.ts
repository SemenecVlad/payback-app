import { useSyncExternalStore } from 'react';

import { delay } from '@/api/client';
import { fetchClaim } from '@/api/claims';
import { Claim } from '@/types/api';

/**
 * Claims created in this browser session, shared by Home (balance overlay, status list) and the claim screen.
 * Polling lives here, not in a component, so a claim keeps being followed after the user navigates away.
 */
const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 3 * 60_000;

let claims: Claim[] = [];
const listeners = new Set<() => void>();
const polling = new Set<string>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function upsert(claim: Claim) {
  claims = claims.some((c) => c.id === claim.id)
    ? claims.map((c) => (c.id === claim.id ? claim : c))
    : [claim, ...claims];
  emit();
}

async function poll(id: string) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  try {
    while (Date.now() < deadline) {
      await delay(POLL_INTERVAL_MS);
      try {
        const claim = await fetchClaim(id);
        upsert(claim);
        if (claim.status !== 'pending') return;
      } catch {
        // A failed status check says nothing about the claim; keep checking until the deadline.
      }
    }
  } finally {
    polling.delete(id);
    emit();
  }
}

/** Records a claim and follows it until it is completed or failed. Safe to call again for the same claim. */
export function trackClaim(claim: Claim) {
  upsert(claim);
  if (claim.status !== 'pending' || polling.has(claim.id)) return;
  polling.add(claim.id);
  void poll(claim.id);
}

export function useLocalClaims(): Claim[] {
  return useSyncExternalStore(subscribe, () => claims, () => claims);
}

export function isPolling(id: string): boolean {
  return polling.has(id);
}
