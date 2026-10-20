import { parseAmountInput } from './amountInput';
import { checkClaimAmount, ClaimRules, maxClaimInput } from './claimAmount';
import { parseDecimal, toApiString } from './decimal';

const d = (value: string) => {
  const parsed = parseDecimal(value);
  if (!parsed) throw new Error(`bad test value ${value}`);
  return parsed;
};

const eth: ClaimRules = {
  asset: 'ETH',
  decimals: 6,
  available: d('0.5'),
  minAmount: d('0.01'),
  fee: d('0.0012'),
};

describe('parseAmountInput', () => {
  it.each([
    ['0.5', '0.5'],
    ['0,5', '0.5'],
    ['  12  ', '12'],
    ['.5', '0.5'],
    ['1.', '1'],
    ['05', '5'],
    ['0.1000000', '0.1'],
  ])('parses %p as %s', (input, expected) => {
    const result = parseAmountInput(input, 6);
    expect(result.ok && toApiString(result.value)).toBe(expected);
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['-1', 'negative'],
    ['abc', 'invalid'],
    ['1e-3', 'invalid'],
    ['1,000.5', 'invalid'],
    ['1 000', 'invalid'],
    ['1.2.3', 'invalid'],
    ['+1', 'invalid'],
    ['$5', 'invalid'],
    ['5 ETH', 'invalid'],
    ['.', 'invalid'],
    ['0.1234567', 'too_many_decimals'],
  ])('rejects %p as %s', (input, error) => {
    expect(parseAmountInput(input, 6)).toEqual({ ok: false, error });
  });
});

describe('checkClaimAmount', () => {
  it('accepts a valid amount and computes what the user receives', () => {
    const result = checkClaimAmount('0.5', eth);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(toApiString(result.amount)).toBe('0.5');
      expect(toApiString(result.receive)).toBe('0.4988');
    }
  });

  it('accepts exactly the minimum', () => {
    const result = checkClaimAmount('0.01', eth);
    expect(result.ok && toApiString(result.receive)).toBe('0.0088');
  });

  it.each([
    ['', 'Enter an amount'],
    ['0', 'Amount must be greater than 0'],
    ['0.000', 'Amount must be greater than 0'],
    ['-0.2', 'Amount must be positive'],
    ['0.009999', 'Minimum claim is 0.01 ETH'],
    ['0.500001', 'Only 0.5 ETH available'],
    ['0.1234567', 'Use at most 6 decimal places'],
    ['abc', 'Enter a number, for example 0.5'],
  ])('rejects %p', (input, message) => {
    expect(checkClaimAmount(input, eth)).toEqual({ ok: false, message });
  });

  it('rejects an amount that does not cover the fee', () => {
    const rules = { ...eth, minAmount: d('0.001') };
    expect(checkClaimAmount('0.0012', rules)).toEqual({ ok: false, message: 'Amount must be larger than the fee' });
  });

  it('respects the asset decimals', () => {
    expect(checkClaimAmount('0.015', { ...eth, decimals: 2 })).toEqual({
      ok: false,
      message: 'Use at most 2 decimal places',
    });
  });
});

describe('maxClaimInput', () => {
  it('fills the whole available balance', () => {
    expect(maxClaimInput({ ...eth, available: d('820.413207') })).toBe('820.413207');
  });

  it('returns null when available is below the minimum', () => {
    expect(maxClaimInput({ ...eth, available: d('0.005') })).toBeNull();
  });
});
