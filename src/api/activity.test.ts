import { toApiString } from '@/money/decimal';

import { fetchActivity } from './activity';
import { apiGet } from './client';

jest.mock('./client', () => ({ apiGet: jest.fn() }));

const mockedGet = apiGet as jest.MockedFunction<typeof apiGet>;

const item = (overrides: Record<string, unknown> = {}) => ({
  id: 'act_1',
  type: 'accrual',
  asset: 'USDT',
  amount: '9.81',
  status: 'confirmed',
  exchange: 'Binance',
  createdAt: '2026-10-20T08:00:00.000Z',
  relatedId: null,
  ...overrides,
});

beforeEach(() => mockedGet.mockReset());

describe('fetchActivity', () => {
  it('requests 20 items and passes the cursor', async () => {
    mockedGet.mockResolvedValue({ items: [], nextCursor: null });
    await fetchActivity(null);
    await fetchActivity('abc/123');
    expect(mockedGet).toHaveBeenNthCalledWith(1, '/v1/activity?limit=20');
    expect(mockedGet).toHaveBeenNthCalledWith(2, '/v1/activity?limit=20&cursor=abc%2F123');
  });

  it('parses signed amounts and the next cursor', async () => {
    mockedGet.mockResolvedValue({
      items: [item(), item({ id: 'act_2', type: 'claim', amount: '-0.5', status: 'pending', exchange: null })],
      nextCursor: 'next',
    });
    const page = await fetchActivity(null);
    expect(page.nextCursor).toBe('next');
    expect(page.items.map((i) => toApiString(i.amount))).toEqual(['9.81', '-0.5']);
    expect(page.items[1]).toMatchObject({ type: 'claim', status: 'pending', exchange: null });
  });

  it('rejects unexpected data instead of showing it', async () => {
    mockedGet.mockResolvedValue({ items: [item({ amount: 9.81 })], nextCursor: null });
    await expect(fetchActivity(null)).rejects.toMatchObject({ kind: 'bad_response' });
    mockedGet.mockResolvedValue({ items: [item({ type: 'bonus' })], nextCursor: null });
    await expect(fetchActivity(null)).rejects.toMatchObject({ kind: 'bad_response' });
  });
});
