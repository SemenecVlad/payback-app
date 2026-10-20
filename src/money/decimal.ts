/**
 * Exact decimal numbers: `units / 10^scale`, with `units` a BigInt.
 * All money math goes through here; JS floats are never used for amounts.
 */
export type Decimal = { readonly units: bigint; readonly scale: number };

const API_FORMAT = /^(0|[1-9]\d*)(\.\d+)?$/;

export const ZERO: Decimal = { units: 0n, scale: 0 };

/** Parses an amount string in the API format ("0.5", "12"). Returns null when the format is invalid. */
export function parseDecimal(value: string): Decimal | null {
  if (!API_FORMAT.test(value)) return null;
  const [intPart, fracPart = ''] = value.split('.');
  return { units: BigInt(intPart + fracPart), scale: fracPart.length };
}

/** Like parseDecimal, with an optional leading minus (activity amounts are signed). */
export function parseSignedDecimal(value: string): Decimal | null {
  if (!value.startsWith('-')) return parseDecimal(value);
  const abs = parseDecimal(value.slice(1));
  return abs ? { units: -abs.units, scale: abs.scale } : null;
}

function pow10(exp: number): bigint {
  return 10n ** BigInt(exp);
}

function rescale(value: Decimal, scale: number): bigint {
  return value.units * pow10(scale - value.scale);
}

function align(a: Decimal, b: Decimal): [bigint, bigint, number] {
  const scale = Math.max(a.scale, b.scale);
  return [rescale(a, scale), rescale(b, scale), scale];
}

export function add(a: Decimal, b: Decimal): Decimal {
  const [x, y, scale] = align(a, b);
  return { units: x + y, scale };
}

export function sub(a: Decimal, b: Decimal): Decimal {
  const [x, y, scale] = align(a, b);
  return { units: x - y, scale };
}

export function mul(a: Decimal, b: Decimal): Decimal {
  return { units: a.units * b.units, scale: a.scale + b.scale };
}

export function compare(a: Decimal, b: Decimal): -1 | 0 | 1 {
  const [x, y] = align(a, b);
  return x < y ? -1 : x > y ? 1 : 0;
}

export function isZero(value: Decimal): boolean {
  return value.units === 0n;
}

/** Rounds to `scale` decimal places, half away from zero. */
export function roundHalfUp(value: Decimal, scale: number): Decimal {
  if (value.scale <= scale) return { units: rescale(value, scale), scale };
  const divisor = pow10(value.scale - scale);
  const negative = value.units < 0n;
  const abs = negative ? -value.units : value.units;
  let quotient = abs / divisor;
  if ((abs % divisor) * 2n >= divisor) quotient += 1n;
  return { units: negative ? -quotient : quotient, scale };
}

/** Plain digits with exactly `scale` decimals, e.g. toFixed(1.5, 2) → "1.50". */
export function toFixed(value: Decimal, scale: number): string {
  const rounded = roundHalfUp(value, scale);
  const negative = rounded.units < 0n;
  const digits = (negative ? -rounded.units : rounded.units).toString().padStart(scale + 1, '0');
  const intPart = digits.slice(0, digits.length - scale);
  const fracPart = digits.slice(digits.length - scale);
  return `${negative ? '-' : ''}${intPart}${scale > 0 ? `.${fracPart}` : ''}`;
}

/** Shortest exact string in the API format: no trailing zeros, no exponent. */
export function toApiString(value: Decimal): string {
  const fixed = toFixed(value, value.scale);
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
}
