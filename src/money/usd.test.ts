import { parseDecimal } from './decimal';
import { formatUsd, usdTotal } from './usd';

const d = (value: string) => {
  const parsed = parseDecimal(value);
  if (!parsed) throw new Error(`bad test value ${value}`);
  return parsed;
};

describe('usdTotal', () => {
  it('sums amount × price exactly and rounds once', () => {
    const total = usdTotal([
      { amount: d('820.413207'), usdPrice: d('1.0002') },
      { amount: d('0.5'), usdPrice: d('3120.45') },
    ]);
    expect(formatUsd(total)).toBe('$2,380.80');
  });

  it('does not lose cents to per-item rounding', () => {
    const items = [0, 1, 2].map(() => ({ amount: d('0.005'), usdPrice: d('1') }));
    expect(formatUsd(usdTotal(items))).toBe('$0.02');
  });

  it('is $0.00 for no items', () => {
    expect(formatUsd(usdTotal([]))).toBe('$0.00');
  });
});

describe('formatUsd', () => {
  it('groups thousands and rounds half up', () => {
    expect(formatUsd(d('1234567.005'))).toBe('$1,234,567.01');
    expect(formatUsd(d('999.994'))).toBe('$999.99');
  });
});
