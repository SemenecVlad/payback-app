import { parseDecimal } from './decimal';
import { formatAmount } from './format';

describe('formatAmount', () => {
  it.each([
    ['820.413207', '820.413207'],
    ['1234567.5', '1,234,567.5'],
    ['1000', '1,000'],
    ['0.000001', '0.000001'],
    ['0', '0'],
  ])('formats %s as %s', (input, expected) => {
    const value = parseDecimal(input);
    expect(value && formatAmount(value)).toBe(expected);
  });
});
