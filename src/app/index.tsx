import { Link, Redirect, router } from 'expo-router';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { ApiError, errorMessage } from '@/api/errors';
import { getToken } from '@/api/tokenStorage';
import { BalanceRow } from '@/components/BalanceRow';
import { Button } from '@/components/Button';
import { ErrorBanner } from '@/components/ErrorBanner';
import { RecentClaims } from '@/components/RecentClaims';
import { TotalCard } from '@/components/TotalCard';
import { colors, fontSize, spacing } from '@/constants/theme';
import { useUnresolvedIntent } from '@/hooks/claimIntent';
import { useBalances } from '@/hooks/useBalances';
import { formatAmount } from '@/money/format';

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.kind === 'unauthorized';
}

export default function HomeScreen() {
  const { snapshot, error, loading, refreshing, refresh, retry } = useBalances();
  const unresolvedIntent = useUnresolvedIntent();

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
          {unresolvedIntent && (
            <ErrorBanner
              message={`Your claim of ${formatAmount(unresolvedIntent.request.amount)} ${unresolvedIntent.request.asset} is not confirmed yet. Don't claim again — check it first.`}
              actionTitle="Check claim"
              onAction={() => router.push({ pathname: '/claim', params: { asset: unresolvedIntent.request.asset } })}
            />
          )}
          {snapshot && <TotalCard snapshot={snapshot} />}
          <RecentClaims />
          {snapshot && <Button title="Refresh" variant="secondary" onPress={refresh} loading={refreshing} />}
          <Button title="Activity" variant="secondary" onPress={() => router.push('/activity')} />
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
