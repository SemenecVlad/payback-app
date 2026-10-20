import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '@/constants/theme';
import { useNow } from '@/hooks/useNow';
import { formatUsd, usdTotal } from '@/money/usd';
import { BalancesSnapshot } from '@/types/api';
import { formatAge } from '@/utils/time';

export function TotalCard({ snapshot }: { snapshot: BalancesSnapshot }) {
  const now = useNow();
  const total = usdTotal(snapshot.items.map((item) => ({ amount: item.available, usdPrice: item.usdPrice })));

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Available to claim</Text>
      <Text style={styles.total} accessibilityLabel={`Total available ${formatUsd(total)}`}>
        {formatUsd(total)}
      </Text>
      <Text style={styles.age}>Updated {formatAge(snapshot.asOf, now)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { fontSize: fontSize.sm, color: colors.textMuted },
  total: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  age: { fontSize: fontSize.sm, color: colors.textMuted },
});
