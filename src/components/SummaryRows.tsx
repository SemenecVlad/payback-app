import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, spacing } from '@/constants/theme';

type SummaryRowsProps = { rows: { label: string; value: string; strong?: boolean }[] };

export function SummaryRows({ rows }: SummaryRowsProps) {
  return (
    <View style={styles.container}>
      {rows.map((row) => (
        <View key={row.label} style={styles.row}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={[styles.value, row.strong && styles.strong]} selectable>
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  label: { fontSize: fontSize.md, color: colors.textMuted },
  value: { fontSize: fontSize.md, color: colors.text, fontVariant: ['tabular-nums'], flexShrink: 1, textAlign: 'right' },
  strong: { fontWeight: '700' },
});
