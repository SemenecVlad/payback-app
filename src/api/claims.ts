import { toApiString } from '@/money/decimal';
import { Claim, ClaimOptions, ClaimStatus, CreateClaimRequest } from '@/types/api';

import { apiGet, apiRequest } from './client';
import { ApiError } from './errors';
import { asArray, asObject, readDecimal, readNullableString, readString } from './parse';

const STATUSES: readonly ClaimStatus[] = ['pending', 'completed', 'failed'];

function parseClaim(value: unknown): Claim {
  const claim = asObject(value, 'claim');
  const status = readString(claim, 'status');
  if (!STATUSES.includes(status as ClaimStatus)) throw new ApiError('bad_response', `Unknown claim status: ${status}`);
  return {
    id: readString(claim, 'id'),
    asset: readString(claim, 'asset'),
    amount: readDecimal(claim, 'amount'),
    fee: readDecimal(claim, 'fee'),
    receiveAmount: readDecimal(claim, 'receiveAmount'),
    destinationId: readString(claim, 'destinationId'),
    status: status as ClaimStatus,
    failureReason: readNullableString(claim, 'failureReason'),
    createdAt: readString(claim, 'createdAt'),
    updatedAt: readString(claim, 'updatedAt'),
  };
}

export async function fetchClaimOptions(asset: string): Promise<ClaimOptions> {
  const body = asObject(await apiGet(`/v1/claim-options?asset=${encodeURIComponent(asset)}`), 'claim options');
  return {
    asset: readString(body, 'asset'),
    minAmount: readDecimal(body, 'minAmount'),
    fee: readDecimal(body, 'fee'),
    destinations: asArray(body.destinations, 'destinations').map((value) => {
      const destination = asObject(value, 'destination');
      return { id: readString(destination, 'id'), label: readString(destination, 'label') };
    }),
  };
}

/**
 * Single attempt, no retries here: the caller decides when to repeat it with the same key.
 * Same key + same body never creates a second claim (docs), so repeating is safe.
 */
export async function createClaim(request: CreateClaimRequest, idempotencyKey: string): Promise<Claim> {
  const response = await apiRequest('/v1/claims', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: { asset: request.asset, amount: toApiString(request.amount), destinationId: request.destinationId },
  });
  return parseClaim(response.body);
}

export async function fetchClaim(id: string): Promise<Claim> {
  return parseClaim(await apiGet(`/v1/claims/${encodeURIComponent(id)}`));
}
