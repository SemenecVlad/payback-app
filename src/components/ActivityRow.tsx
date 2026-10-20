import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '@/constants/theme';
import { compare, ZERO } from '@/money/decimal';
import { formatAmount } from '@/money/format';
import { ActivityItem, ActivityStatus } from '@/types/api';

const STATUS_COLOR: Record<ActivityStatus, string> = {
  pending: colors.warning,
  confirmed: colors.success,
  completed: colors.success,
  failed: colors.danger,
};

const STATUS_LABEL: Record<ActivityStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
  failed: 'Failed',
};

function title(item: ActivityItem): string {
  switch (item.type) {
    case 'accrual':
      return item.exchange ? `Payback from ${item.exchange}` : 'Payback';
    case 'reversal':
      return item.exchange ? `Reversed by ${item.exchange}` : 'Reversal';
    case 'claim':
      return 'Claim';
  }
}

function signedAmount(item: ActivityItem): string {
  return compare(item.amount, ZERO) > 0 ? `+${formatAmount(item.amount)}` : formatAmount(item.amount);
}

export function ActivityRow({ item }: { item: ActivityItem }) {
  const createdAt = new Date(item.createdAt);
  const negative = compare(item.amount, ZERO) < 0;
  return (
    <View style={styles.row}>
      <View style={styles.main}>
        <Text style={styles.title}>{title(item)}</Text>
        <Text style={styles.meta}>
          {Number.isNaN(createdAt.getTime()) ? item.createdAt : createdAt.toLocaleString()}
        </Text>
      </View>
      <View style={styles.side}>
        <Text style={[styles.amount, negative && styles.negative, item.status === 'failed' && styles.struck]}>
          {signedAmount(item)} {item.asset}
        </Text>
        <Text style={[styles.status, { color: STATUS_COLOR[item.status] }]}>{STATUS_LABEL[item.status]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  main: { flex: 1, gap: spacing.xs },
  side: { alignItems: 'flex-end', gap: spacing.xs, flexShrink: 1 },
  title: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  meta: { fontSize: fontSize.sm, color: colors.textMuted },
  amount: { fontSize: fontSize.md, color: colors.success, fontVariant: ['tabular-nums'], textAlign: 'right' },
  negative: { color: colors.text },
  struck: { textDecorationLine: 'line-through', color: colors.textMuted },
  status: { fontSize: fontSize.sm },
});
