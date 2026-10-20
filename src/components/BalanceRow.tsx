import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '@/constants/theme';
import { isZero, mul } from '@/money/decimal';
import { formatAmount } from '@/money/format';
import { formatUsd } from '@/money/usd';
import { Balance } from '@/types/api';

import { Button } from './Button';

export function BalanceRow({ balance }: { balance: Balance }) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.asset}>{balance.asset}</Text>
        <Text style={styles.usd}>{formatUsd(mul(balance.available, balance.usdPrice))}</Text>
      </View>
      <Text style={styles.available} selectable>
        {formatAmount(balance.available)} <Text style={styles.label}>available</Text>
      </Text>
      {!isZero(balance.pending) && (
        <Text style={styles.secondary}>
          {formatAmount(balance.pending)} pending confirmation
        </Text>
      )}
      {!isZero(balance.claiming) && (
        <Text style={styles.secondary}>{formatAmount(balance.claiming)} being claimed</Text>
      )}
      <Button
        title={`Claim ${balance.asset}`}
        variant="secondary"
        disabled={isZero(balance.available)}
        onPress={() => router.push({ pathname: '/claim', params: { asset: balance.asset } })}
      />
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  asset: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  usd: { fontSize: fontSize.md, color: colors.textMuted },
  available: { fontSize: fontSize.md, color: colors.text, fontVariant: ['tabular-nums'] },
  label: { color: colors.textMuted },
  secondary: { fontSize: fontSize.sm, color: colors.textMuted },
});
