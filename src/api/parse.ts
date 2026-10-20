import { Decimal, parseDecimal } from '@/money/decimal';

import { ApiError } from './errors';

/** Guards for response bodies: the server is remote and may send unexpected data. */
export type Json = Record<string, unknown>;

function bad(what: string): ApiError {
  return new ApiError('bad_response', `Unexpected response: ${what}`);
}

export function asObject(value: unknown, what: string): Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw bad(what);
  return value as Json;
}

export function asArray(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) throw bad(what);
  return value;
}

export function readString(obj: Json, key: string): string {
  const value = obj[key];
  if (typeof value !== 'string') throw bad(key);
  return value;
}

export function readNullableString(obj: Json, key: string): string | null {
  const value = obj[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw bad(key);
  return value;
}

export function readInteger(obj: Json, key: string): number {
  const value = obj[key];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw bad(key);
  return value;
}

export function readDecimal(obj: Json, key: string): Decimal {
  const value = parseDecimal(readString(obj, key));
  if (!value) throw bad(key);
  return value;
}
