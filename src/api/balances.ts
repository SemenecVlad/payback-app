import { Balance, BalancesSnapshot } from '@/types/api';

import { apiGet } from './client';
import { asArray, asObject, readDecimal, readInteger, readString } from './parse';

function parseBalance(value: unknown): Balance {
  const item = asObject(value, 'balance');
  return {
    asset: readString(item, 'asset'),
    decimals: readInteger(item, 'decimals'),
    available: readDecimal(item, 'available'),
    pending: readDecimal(item, 'pending'),
    claiming: readDecimal(item, 'claiming'),
    usdPrice: readDecimal(item, 'usdPrice'),
  };
}

export async function fetchBalances(): Promise<BalancesSnapshot> {
  const body = asObject(await apiGet('/v1/balances'), 'balances');
  return {
    asOf: readString(body, 'asOf'),
    items: asArray(body.items, 'items').map(parseBalance),
  };
}
