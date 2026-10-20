import { add, Decimal, mul, toFixed, ZERO } from './decimal';

type Priced = { amount: Decimal; usdPrice: Decimal };

/** Exact sum of amount × price; rounding happens only once, when formatting. */
export function usdTotal(items: Priced[]): Decimal {
  return items.reduce((sum, item) => add(sum, mul(item.amount, item.usdPrice)), ZERO);
}

/** "$1,234.57", rounded half up to cents. */
export function formatUsd(value: Decimal): string {
  const fixed = toFixed(value, 2);
  const negative = fixed.startsWith('-');
  const [intPart, fracPart] = (negative ? fixed.slice(1) : fixed).split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}$${grouped}.${fracPart}`;
}
