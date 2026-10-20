import { act, renderHook, waitFor } from '@testing-library/react-native';

import { fetchActivity } from '@/api/activity';
import { ApiError } from '@/api/errors';
import { parseSignedDecimal } from '@/money/decimal';
import { ActivityItem, ActivityPage } from '@/types/api';

import { useActivity } from './useActivity';

jest.mock('@/api/activity', () => ({ fetchActivity: jest.fn() }));

const mockedFetch = fetchActivity as jest.MockedFunction<typeof fetchActivity>;

function item(id: string): ActivityItem {
  const amount = parseSignedDecimal('1');
  if (!amount) throw new Error('bad test value');
  return {
    id,
    type: 'accrual',
    asset: 'USDT',
    amount,
    status: 'confirmed',
    exchange: 'Binance',
    createdAt: '2026-10-20T08:00:00.000Z',
    relatedId: null,
  };
}

const page = (ids: string[], nextCursor: string | null): ActivityPage => ({ items: ids.map(item), nextCursor });

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const ids = (items: ActivityItem[]) => items.map((i) => i.id);

beforeEach(() => mockedFetch.mockReset());

describe('useActivity', () => {
  it('loads the first page, then appends the next one without duplicates', async () => {
    mockedFetch.mockResolvedValueOnce(page(['a', 'b'], 'c1')).mockResolvedValueOnce(page(['b', 'c'], null));
    const { result } = await renderHook(() => useActivity());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(ids(result.current.items)).toEqual(['a', 'b']);

    await act(() => result.current.loadMore());
    expect(mockedFetch).toHaveBeenLastCalledWith('c1');
    expect(ids(result.current.items)).toEqual(['a', 'b', 'c']);
    expect(result.current.nextCursor).toBeNull();
  });

  it('does nothing on load more after the last page', async () => {
    mockedFetch.mockResolvedValueOnce(page(['a'], null));
    const { result } = await renderHook(() => useActivity());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.loadMore());
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it('drops a next page that arrives after a refresh started', async () => {
    const slowPage2 = deferred<ActivityPage>();
    mockedFetch
      .mockResolvedValueOnce(page(['a', 'b'], 'c1'))
      .mockReturnValueOnce(slowPage2.promise)
      .mockResolvedValueOnce(page(['new', 'a'], 'c2'));
    const { result } = await renderHook(() => useActivity());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let pending: Promise<void> = Promise.resolve();
    await act(async () => {
      pending = result.current.loadMore();
    });
    await act(async () => result.current.refresh());
    await waitFor(() => expect(result.current.refreshing).toBe(false));

    await act(async () => {
      slowPage2.resolve(page(['old-page-2'], 'stale'));
      await pending;
    });
    expect(ids(result.current.items)).toEqual(['new', 'a']);
    expect(result.current.nextCursor).toBe('c2');
    expect(result.current.loadingMore).toBe(false);
  });

  it('keeps the list when a further page fails, and can try again', async () => {
    mockedFetch
      .mockResolvedValueOnce(page(['a'], 'c1'))
      .mockRejectedValueOnce(new ApiError('network', 'Network error'))
      .mockResolvedValueOnce(page(['b'], null));
    const { result } = await renderHook(() => useActivity());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.loadMore());
    expect(result.current.moreError).toBeInstanceOf(ApiError);
    expect(ids(result.current.items)).toEqual(['a']);

    await act(() => result.current.loadMore());
    expect(result.current.moreError).toBeNull();
    expect(ids(result.current.items)).toEqual(['a', 'b']);
  });

  it('shows a first-page error and recovers on retry', async () => {
    mockedFetch
      .mockRejectedValueOnce(new ApiError('server', 'down', { status: 503 }))
      .mockResolvedValueOnce(page(['a'], null));
    const { result } = await renderHook(() => useActivity());
    await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError));
    expect(result.current.items).toEqual([]);

    await act(async () => result.current.retry());
    await waitFor(() => expect(ids(result.current.items)).toEqual(['a']));
    expect(result.current.error).toBeNull();
  });
});
