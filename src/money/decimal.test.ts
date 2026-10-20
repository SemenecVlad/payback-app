import { add, compare, mul, parseDecimal, roundHalfUp, sub, toApiString, toFixed } from './decimal';

const d = (value: string) => {
  const parsed = parseDecimal(value);
  if (!parsed) throw new Error(`bad test value ${value}`);
  return parsed;
};

describe('parseDecimal', () => {
  it.each(['0', '12', '0.5', '820.413207', '0.000001'])('accepts %s', (value) => {
    expect(toApiString(d(value))).toBe(value);
  });

  it.each(['.5', '1.', '05', '1e-3', '-1', '', ' 1', '1,5', '1.2.3', 'NaN'])('rejects %p', (value) => {
    expect(parseDecimal(value)).toBeNull();
  });
});

describe('arithmetic', () => {
  it('adds and subtracts exactly where floats fail', () => {
    expect(toApiString(add(d('0.1'), d('0.2')))).toBe('0.3');
    expect(toApiString(sub(d('0.5'), d('0.0012')))).toBe('0.4988');
  });

  it('keeps precision for large values', () => {
    expect(toApiString(add(d('9007199254740993.000001'), d('0.000001')))).toBe('9007199254740993.000002');
  });

  it('multiplies', () => {
    expect(toApiString(mul(d('820.413207'), d('1.0002')))).toBe('820.5772896414');
  });

  it('compares across scales', () => {
    expect(compare(d('0.5'), d('0.50000'))).toBe(0);
    expect(compare(d('0.01'), d('0.009999'))).toBe(1);
    expect(compare(d('1'), d('1.000001'))).toBe(-1);
  });
});

describe('rounding and formatting', () => {
  it('rounds half up', () => {
    expect(toFixed(d('1.005'), 2)).toBe('1.01');
    expect(toFixed(d('1.004999'), 2)).toBe('1.00');
    expect(toFixed(sub(d('0'), d('1.005')), 2)).toBe('-1.01');
  });

  it('pads when increasing scale', () => {
    expect(toFixed(d('3'), 2)).toBe('3.00');
    expect(toFixed(d('0.05'), 2)).toBe('0.05');
    expect(roundHalfUp(d('0.5'), 0).units).toBe(1n);
  });

  it('trims trailing zeros for the API', () => {
    expect(toApiString(d('1.500'))).toBe('1.5');
    expect(toApiString(d('2.000'))).toBe('2');
    expect(toApiString(d('100'))).toBe('100');
  });
});
