import { Decimal } from '@/money/decimal';

export type Balance = {
  asset: string;
  decimals: number;
  available: Decimal;
  pending: Decimal;
  claiming: Decimal;
  usdPrice: Decimal;
};

export type BalancesSnapshot = {
  /** ISO time of the server snapshot (recomputed every 15 s). */
  asOf: string;
  items: Balance[];
};

export type Destination = { id: string; label: string };

export type ClaimOptions = {
  asset: string;
  minAmount: Decimal;
  fee: Decimal;
  destinations: Destination[];
};

export type ClaimStatus = 'pending' | 'completed' | 'failed';

export type Claim = {
  id: string;
  asset: string;
  amount: Decimal;
  fee: Decimal;
  receiveAmount: Decimal;
  destinationId: string;
  status: ClaimStatus;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateClaimRequest = {
  asset: string;
  amount: Decimal;
  destinationId: string;
};
