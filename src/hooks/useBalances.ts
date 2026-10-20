import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { fetchBalances } from '@/api/balances';
import { BalancesSnapshot } from '@/types/api';
import { applyLocalClaims } from '@/utils/balanceOverlay';

import { useLocalClaims } from './localClaims';

/** The server recomputes balance snapshots every 15 s. */
const AUTO_REFRESH_MS = 15_000;

type BalancesState = {
  snapshot: BalancesSnapshot | null;
  error: unknown;
  loading: boolean;
  refreshing: boolean;
};

/** Never replace a snapshot with an older one (a slow response arriving late must not move numbers back). */
function newer(current: BalancesSnapshot | null, next: BalancesSnapshot): BalancesSnapshot {
  if (current && Date.parse(next.asOf) < Date.parse(current.asOf)) return current;
  return next;
}

export function useBalances() {
  const [state, setState] = useState<BalancesState>({ snapshot: null, error: null, loading: true, refreshing: false });
  const inFlight = useRef(false);

  const load = useCallback(async (mode: 'initial' | 'refresh' | 'silent') => {
    if (inFlight.current) return;
    inFlight.current = true;
    setState((s) => ({ ...s, loading: mode === 'initial' && !s.snapshot, refreshing: mode === 'refresh' }));
    try {
      const next = await fetchBalances();
      setState((s) => ({ snapshot: newer(s.snapshot, next), error: null, loading: false, refreshing: false }));
    } catch (error) {
      setState((s) => ({ ...s, error, loading: false, refreshing: false }));
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    load('initial');
    const id = setInterval(() => load('silent'), AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const refresh = useCallback(() => load('refresh'), [load]);
  const retry = useCallback(() => load('initial'), [load]);

  const localClaims = useLocalClaims();
  const snapshot = useMemo(
    () => (state.snapshot ? applyLocalClaims(state.snapshot, localClaims) : null),
    [state.snapshot, localClaims],
  );

  return { ...state, snapshot, refresh, retry };
}
