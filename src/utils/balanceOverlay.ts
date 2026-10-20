import { add, compare, Decimal, sub, ZERO } from '@/money/decimal';
import { BalancesSnapshot, Claim } from '@/types/api';

/**
 * Applies claims created in this session that the snapshot doesn't include yet
 * (snapshot `asOf` is before the claim's `createdAt`). Once a snapshot with `asOf >= createdAt`
 * arrives, the server numbers already contain the claim and the overlay stops, so nothing jumps back.
 * Failed claims return their amount to `available`, so they are never applied.
 */
export function applyLocalClaims(snapshot: BalancesSnapshot, claims: Claim[]): BalancesSnapshot {
  const asOf = Date.parse(snapshot.asOf);
  const unseen = claims.filter((claim) => claim.status !== 'failed' && Date.parse(claim.createdAt) > asOf);
  if (unseen.length === 0) return snapshot;

  return {
    ...snapshot,
    items: snapshot.items.map((item) => {
      const own = unseen.filter((claim) => claim.asset === item.asset);
      if (own.length === 0) return item;
      const claimed = own.reduce<Decimal>((sum, claim) => add(sum, claim.amount), ZERO);
      const stillClaiming = own
        .filter((claim) => claim.status === 'pending')
        .reduce<Decimal>((sum, claim) => add(sum, claim.amount), ZERO);
      const available = sub(item.available, claimed);
      return {
        ...item,
        // An older snapshot can miss accruals confirmed since, so never show a negative balance.
        available: compare(available, ZERO) < 0 ? ZERO : available,
        claiming: add(item.claiming, stillClaiming),
      };
    }),
  };
}
