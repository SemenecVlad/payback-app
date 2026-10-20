import { ActivityItem, ActivityPage, ActivityStatus, ActivityType } from '@/types/api';

import { apiGet } from './client';
import { asArray, asObject, readNullableString, readOneOf, readSignedDecimal, readString } from './parse';

export const ACTIVITY_PAGE_SIZE = 20;

const TYPES: readonly ActivityType[] = ['accrual', 'reversal', 'claim'];
const STATUSES: readonly ActivityStatus[] = ['pending', 'confirmed', 'completed', 'failed'];

function parseItem(value: unknown): ActivityItem {
  const item = asObject(value, 'activity item');
  return {
    id: readString(item, 'id'),
    type: readOneOf(item, 'type', TYPES),
    asset: readString(item, 'asset'),
    amount: readSignedDecimal(item, 'amount'),
    status: readOneOf(item, 'status', STATUSES),
    exchange: readNullableString(item, 'exchange'),
    createdAt: readString(item, 'createdAt'),
    relatedId: readNullableString(item, 'relatedId'),
  };
}

export async function fetchActivity(cursor: string | null): Promise<ActivityPage> {
  const query = `limit=${ACTIVITY_PAGE_SIZE}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
  const body = asObject(await apiGet(`/v1/activity?${query}`), 'activity');
  return {
    items: asArray(body.items, 'items').map(parseItem),
    nextCursor: readNullableString(body, 'nextCursor'),
  };
}
