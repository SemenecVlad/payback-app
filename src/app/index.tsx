import { Link, Redirect, router } from 'expo-router';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { ApiError, errorMessage } from '@/api/errors';
import { getToken } from '@/api/tokenStorage';
import { BalanceRow } from '@/components/BalanceRow';
import { Button } from '@/components/Button';
import { ErrorBanner } from '@/components/ErrorBanner';
import { TotalCard } from '@/components/TotalCard';
import { colors, fontSize, spacing } from '@/constants/theme';
import { useBalances } from '@/hooks/useBalances';

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.kind === 'unauthorized';
}

export default function HomeScreen() {
  const { snapshot, error, loading, refreshing, refresh, retry } = useBalances();

  if (!getToken()) return <Redirect href="/token" />;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.muted}>Loading balances…</Text>
      </View>
    );
  }

  const errorBanner = error ? (
    isUnauthorized(error) ? (
      <ErrorBanner message={errorMessage(error)} actionTitle="Change token" onAction={() => router.push('/token')} />
    ) : (
      <ErrorBanner
        message={snapshot ? `Couldn't refresh. ${errorMessage(error)}` : errorMessage(error)}
        onAction={snapshot ? refresh : retry}
      />
    )
  ) : null;

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={snapshot?.items ?? []}
      keyExtractor={(item) => item.asset}
      renderItem={({ item }) => <BalanceRow balance={item} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      ListHeaderComponent={
        <View style={styles.header}>
          {errorBanner}
          {snapshot && <TotalCard snapshot={snapshot} />}
          {snapshot && <Button title="Refresh" variant="secondary" onPress={refresh} loading={refreshing} />}
        </View>
      }
      ListEmptyComponent={snapshot ? <Text style={styles.muted}>No balances yet.</Text> : undefined}
      ListFooterComponent={
        <Link href="/token" style={styles.link}>
          Change token
        </Link>
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  list: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md },
  header: { gap: spacing.md },
  muted: { color: colors.textMuted, fontSize: fontSize.md, textAlign: 'center' },
  link: { color: colors.primary, fontSize: fontSize.md, textAlign: 'center', paddingVertical: spacing.md },
});
