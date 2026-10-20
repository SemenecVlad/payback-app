import { useCallback, useEffect, useState } from 'react';

import { fetchClaimOptions } from '@/api/claims';
import { ClaimOptions } from '@/types/api';

type ClaimOptionsState = { options: ClaimOptions | null; error: unknown; loading: boolean };

const LOADING: ClaimOptionsState = { options: null, error: null, loading: true };

async function load(asset: string): Promise<ClaimOptionsState> {
  try {
    return { options: await fetchClaimOptions(asset), error: null, loading: false };
  } catch (error) {
    return { options: null, error, loading: false };
  }
}

/** Mount with `key={asset}` so a different asset starts from a fresh loading state. */
export function useClaimOptions(asset: string) {
  const [state, setState] = useState<ClaimOptionsState>(LOADING);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    load(asset).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [asset, attempt]);

  const retry = useCallback(() => {
    setState(LOADING);
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, retry };
}
