import { parseAmountInput } from './amountInput';
import { compare, Decimal, isZero, sub, toApiString } from './decimal';

export type ClaimRules = {
  asset: string;
  decimals: number;
  available: Decimal;
  minAmount: Decimal;
  fee: Decimal;
};

export type ClaimAmountCheck =
  | { ok: true; amount: Decimal; receive: Decimal }
  | { ok: false; message: string };

export function receiveAmount(amount: Decimal, fee: Decimal): Decimal {
  return sub(amount, fee);
}

/** Validates user input against the claim rules from the API docs: minAmount <= amount <= available, max decimals, receive > 0. */
export function checkClaimAmount(input: string, rules: ClaimRules): ClaimAmountCheck {
  const parsed = parseAmountInput(input, rules.decimals);
  if (!parsed.ok) {
    switch (parsed.error) {
      case 'empty':
        return { ok: false, message: 'Enter an amount' };
      case 'negative':
        return { ok: false, message: 'Amount must be positive' };
      case 'too_many_decimals':
        return { ok: false, message: `Use at most ${rules.decimals} decimal places` };
      case 'invalid':
        return { ok: false, message: 'Enter a number, for example 0.5' };
    }
  }

  const amount = parsed.value;
  if (isZero(amount)) return { ok: false, message: 'Amount must be greater than 0' };
  if (compare(amount, rules.minAmount) < 0) {
    return { ok: false, message: `Minimum claim is ${toApiString(rules.minAmount)} ${rules.asset}` };
  }
  if (compare(amount, rules.available) > 0) {
    return { ok: false, message: `Only ${toApiString(rules.available)} ${rules.asset} available` };
  }

  const receive = receiveAmount(amount, rules.fee);
  if (compare(receive, { units: 0n, scale: 0 }) <= 0) {
    return { ok: false, message: 'Amount must be larger than the fee' };
  }
  return { ok: true, amount, receive };
}

/** The Max button fills in the whole available balance, or nothing if it is below the minimum. */
export function maxClaimInput(rules: ClaimRules): string | null {
  if (compare(rules.available, rules.minAmount) < 0) return null;
  return toApiString(rules.available);
}
