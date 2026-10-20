import { formatAge } from './time';

const asOf = '2026-10-20T08:01:15.000Z';
const at = (offsetMs: number) => Date.parse(asOf) + offsetMs;

describe('formatAge', () => {
  it.each([
    [-10_000, 'just now'],
    [2_000, 'just now'],
    [12_000, '12 s ago'],
    [3 * 60_000, '3 min ago'],
    [2 * 3_600_000, '2 h ago'],
  ])('offset %i ms → %s', (offset, expected) => {
    expect(formatAge(asOf, at(offset))).toBe(expected);
  });

  it('handles an invalid time', () => {
    expect(formatAge('not a date', Date.now())).toBe('unknown');
  });
});
