import { Decimal, toApiString } from './decimal';

/** Display format for asset amounts: exact, no trailing zeros, thousands grouped ("1,234.5"). */
export function formatAmount(value: Decimal): string {
  const plain = toApiString(value);
  const negative = plain.startsWith('-');
  const [intPart, fracPart] = (negative ? plain.slice(1) : plain).split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}${fracPart ? `.${fracPart}` : ''}`;
}
