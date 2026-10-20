import { Decimal } from './decimal';

export type AmountInputError = 'empty' | 'invalid' | 'negative' | 'too_many_decimals';

export type AmountInputResult =
  | { ok: true; value: Decimal }
  | { ok: false; error: AmountInputError };

// One decimal separator, digits only. "1." and ".5" are accepted while typing; output is canonical anyway.
const INPUT_FORMAT = /^(\d+\.?\d*|\.\d+)$/;

/**
 * Parses what the user typed. A comma is treated as the decimal separator (uk/eu keyboards);
 * thousands separators, spaces inside, signs and exponents are rejected rather than guessed.
 */
export function parseAmountInput(raw: string, decimals: number): AmountInputResult {
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: false, error: 'empty' };
  if (trimmed.startsWith('-')) return { ok: false, error: 'negative' };

  const normalized = trimmed.replace(',', '.');
  if (!INPUT_FORMAT.test(normalized)) return { ok: false, error: 'invalid' };

  const [intPart, rawFrac = ''] = normalized.split('.');
  const fracPart = rawFrac.replace(/0+$/, '');
  if (fracPart.length > decimals) return { ok: false, error: 'too_many_decimals' };

  return { ok: true, value: { units: BigInt((intPart || '0') + fracPart), scale: fracPart.length } };
}
