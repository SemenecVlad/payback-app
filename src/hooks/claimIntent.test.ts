import { parseDecimal, toApiString } from '@/money/decimal';

const mockStore = new Map<string, string>();

jest.mock('@/utils/storage', () => ({
  readItem: (key: string) => mockStore.get(key) ?? null,
  writeItem: (key: string, value: string) => {
    mockStore.set(key, value);
    return true;
  },
  removeItem: (key: string) => {
    mockStore.delete(key);
  },
}));

type ClaimIntentModule = typeof import('./claimIntent');

/** Simulates a page reload: the module re-reads storage on load. */
function reloadModule(): ClaimIntentModule {
  let mod: ClaimIntentModule | undefined;
  jest.isolateModules(() => {
    mod = jest.requireActual<ClaimIntentModule>('./claimIntent');
  });
  if (!mod) throw new Error('module not loaded');
  return mod;
}

const amount = parseDecimal('0.5');
if (!amount) throw new Error('bad test value');
const request = { asset: 'ETH', amount, destinationId: 'dest_wallet' };

beforeEach(() => mockStore.clear());

const HOUR = 60 * 60 * 1000;
const createdAt = Date.parse('2026-10-20T10:00:00Z');

describe('unresolved claim intent', () => {
  it('survives a reload with the same idempotency key, body and creation time', () => {
    reloadModule().setUnresolvedIntent({ request, key: 'key-123', createdAt });
    const restored = reloadModule().getUnresolvedIntent();
    expect(restored?.key).toBe('key-123');
    expect(restored?.createdAt).toBe(createdAt);
    expect(restored?.request.asset).toBe('ETH');
    expect(restored && toApiString(restored.request.amount)).toBe('0.5');
  });

  it('is removed once the outcome is known', () => {
    const mod = reloadModule();
    mod.setUnresolvedIntent({ request, key: 'key-123', createdAt });
    mod.setUnresolvedIntent(null);
    expect(reloadModule().getUnresolvedIntent()).toBeNull();
  });

  it('stops being safe to re-send an hour before the 24 h key lifetime', () => {
    const { isIntentExpired } = reloadModule();
    const intent = { request, key: 'key-123', createdAt };
    expect(isIntentExpired(intent, createdAt + 22 * HOUR)).toBe(false);
    expect(isIntentExpired(intent, createdAt + 23 * HOUR)).toBe(true);
    expect(isIntentExpired(intent, createdAt + 25 * HOUR)).toBe(true);
  });

  it('treats a stored intent without a creation time as expired', () => {
    mockStore.set(
      'cashmine.unresolvedClaim',
      JSON.stringify({ asset: 'ETH', amount: '0.5', destinationId: 'dest_wallet', key: 'old-key' }),
    );
    const mod = reloadModule();
    const restored = mod.getUnresolvedIntent();
    expect(restored?.key).toBe('old-key');
    expect(restored && mod.isIntentExpired(restored, Date.now())).toBe(true);
  });

  it('drops corrupted storage instead of crashing', () => {
    mockStore.set('cashmine.unresolvedClaim', '{"asset":"ETH","amount":"1e-3","key":"k"}');
    expect(reloadModule().getUnresolvedIntent()).toBeNull();
    expect(mockStore.size).toBe(0);
  });

  it('compares requests by exact amount', () => {
    const { sameRequest } = reloadModule();
    const same = parseDecimal('0.50');
    const other = parseDecimal('0.500001');
    if (!same || !other) throw new Error('bad test value');
    expect(sameRequest(request, { ...request, amount: same })).toBe(true);
    expect(sameRequest(request, { ...request, amount: other })).toBe(false);
  });
});
