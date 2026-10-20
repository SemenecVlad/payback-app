import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchActivity } from '@/api/activity';
import { ActivityItem } from '@/types/api';

type ActivityState = {
  items: ActivityItem[];
  nextCursor: string | null;
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  /** Error loading the first page. */
  error: unknown;
  /** Error loading a further page (the list stays). */
  moreError: unknown;
};

const INITIAL: ActivityState = {
  items: [],
  nextCursor: null,
  loading: true,
  refreshing: false,
  loadingMore: false,
  error: null,
  moreError: null,
};

/** New history can arrive between pages and shift them, so the same item may come twice. */
function appendUnique(current: ActivityItem[], next: ActivityItem[]): ActivityItem[] {
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...next.filter((item) => !seen.has(item.id))];
}

export function useActivity() {
  const [state, setState] = useState<ActivityState>(INITIAL);
  const [reloadCount, setReloadCount] = useState(0);
  /**
   * Bumped by every first-page load. A response from an older generation belongs to a list
   * that has been replaced, e.g. "load more" finishing after a refresh, and is dropped.
   */
  const generation = useRef(0);
  const loadingMore = useRef(false);

  useEffect(() => {
    const gen = ++generation.current;
    loadingMore.current = false;
    fetchActivity(null)
      .then((page) => {
        if (gen !== generation.current) return;
        setState({ ...INITIAL, loading: false, items: page.items, nextCursor: page.nextCursor });
      })
      .catch((error: unknown) => {
        if (gen !== generation.current) return;
        setState((s) => ({ ...s, loading: false, refreshing: false, error }));
      });
  }, [reloadCount]);

  const reload = useCallback((mode: 'retry' | 'refresh') => {
    setState((s) =>
      mode === 'retry' ? INITIAL : { ...s, refreshing: true, loadingMore: false, error: null, moreError: null },
    );
    setReloadCount((n) => n + 1);
  }, []);

  const { nextCursor, loading, refreshing } = state;

  const loadMore = useCallback(async () => {
    if (!nextCursor || loading || refreshing || loadingMore.current) return;
    const gen = generation.current;
    loadingMore.current = true;
    setState((s) => ({ ...s, loadingMore: true, moreError: null }));
    try {
      const page = await fetchActivity(nextCursor);
      if (gen !== generation.current) return;
      setState((s) => ({
        ...s,
        loadingMore: false,
        items: appendUnique(s.items, page.items),
        nextCursor: page.nextCursor,
      }));
    } catch (moreError) {
      if (gen !== generation.current) return;
      setState((s) => ({ ...s, loadingMore: false, moreError }));
    } finally {
      if (gen === generation.current) loadingMore.current = false;
    }
  }, [nextCursor, loading, refreshing]);

  const refresh = useCallback(() => reload('refresh'), [reload]);
  const retry = useCallback(() => reload('retry'), [reload]);

  return { ...state, loadMore, refresh, retry };
}
