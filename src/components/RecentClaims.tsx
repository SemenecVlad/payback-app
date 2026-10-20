import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '@/constants/theme';
import { useLocalClaims } from '@/hooks/localClaims';
import { formatAmount } from '@/money/format';
import { ClaimStatus } from '@/types/api';

const STATUS_TEXT: Record<ClaimStatus, string> = {
  pending: 'Processing…',
  completed: 'Completed',
  failed: 'Failed',
};

/** Claims made in this session, so a just-submitted claim is always visible on Home. */
export function RecentClaims() {
  const claims = useLocalClaims();
  if (claims.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Your claims</Text>
      {claims.map((claim) => (
        <View key={claim.id} style={styles.row}>
          <Text style={styles.amount}>
            {formatAmount(claim.amount)} {claim.asset}
          </Text>
          <Text style={[styles.status, styles[claim.status]]}>
            {STATUS_TEXT[claim.status]}
            {claim.status === 'failed' && claim.failureReason ? `: ${claim.failureReason}` : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heading: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  amount: { fontSize: fontSize.md, color: colors.text, fontVariant: ['tabular-nums'] },
  status: { fontSize: fontSize.sm, flexShrink: 1, textAlign: 'right' },
  pending: { color: colors.warning },
  completed: { color: colors.success },
  failed: { color: colors.danger },
});
