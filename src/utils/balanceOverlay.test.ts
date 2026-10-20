import { parseDecimal, toApiString } from '@/money/decimal';
import { Balance, BalancesSnapshot, Claim, ClaimStatus } from '@/types/api';

import { applyLocalClaims } from './balanceOverlay';

const d = (value: string) => {
  const parsed = parseDecimal(value);
  if (!parsed) throw new Error(`bad test value ${value}`);
  return parsed;
};

const eth: Balance = {
  asset: 'ETH',
  decimals: 6,
  available: d('1'),
  pending: d('0'),
  claiming: d('0'),
  usdPrice: d('3000'),
};

const snapshot = (asOf: string, overrides: Partial<Balance> = {}): BalancesSnapshot => ({
  asOf,
  items: [{ ...eth, ...overrides }],
});

const claim = (createdAt: string, status: ClaimStatus = 'pending', amount = '0.4'): Claim => ({
  id: `clm_${createdAt}`,
  asset: 'ETH',
  amount: d(amount),
  fee: d('0.0012'),
  receiveAmount: d('0.3988'),
  destinationId: 'dest_wallet',
  status,
  failureReason: status === 'failed' ? 'Rejected' : null,
  createdAt,
  updatedAt: createdAt,
});

const view = (s: BalancesSnapshot) => ({
  available: toApiString(s.items[0].available),
  claiming: toApiString(s.items[0].claiming),
});

describe('applyLocalClaims', () => {
  it('moves a pending claim from available to claiming while the snapshot predates it', () => {
    const result = applyLocalClaims(snapshot('2026-10-20T10:00:00Z'), [claim('2026-10-20T10:00:05Z')]);
    expect(view(result)).toEqual({ available: '0.6', claiming: '0.4' });
  });

  it('stops applying once a snapshot at or after createdAt arrives (no double count, no jump back)', () => {
    const server = snapshot('2026-10-20T10:00:05Z', { available: d('0.6'), claiming: d('0.4') });
    const result = applyLocalClaims(server, [claim('2026-10-20T10:00:05Z')]);
    expect(view(result)).toEqual({ available: '0.6', claiming: '0.4' });
  });

  it('keeps available reduced for a completed claim the snapshot has not seen', () => {
    const result = applyLocalClaims(snapshot('2026-10-20T10:00:00Z'), [claim('2026-10-20T10:00:05Z', 'completed')]);
    expect(view(result)).toEqual({ available: '0.6', claiming: '0' });
  });

  it('ignores failed claims: the amount is back in available', () => {
    const result = applyLocalClaims(snapshot('2026-10-20T10:00:00Z'), [claim('2026-10-20T10:00:05Z', 'failed')]);
    expect(view(result)).toEqual({ available: '1', claiming: '0' });
  });

  it('sums several claims and leaves other assets alone', () => {
    const base: BalancesSnapshot = {
      asOf: '2026-10-20T10:00:00Z',
      items: [eth, { ...eth, asset: 'BTC' }],
    };
    const result = applyLocalClaims(base, [claim('2026-10-20T10:00:01Z'), claim('2026-10-20T10:00:02Z', 'pending', '0.1')]);
    expect(view(result)).toEqual({ available: '0.5', claiming: '0.5' });
    expect(toApiString(result.items[1].available)).toBe('1');
  });

  it('never shows a negative available', () => {
    const result = applyLocalClaims(snapshot('2026-10-20T10:00:00Z', { available: d('0.3') }), [
      claim('2026-10-20T10:00:05Z'),
    ]);
    expect(view(result).available).toBe('0');
  });
});
