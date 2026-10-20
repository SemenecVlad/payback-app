import { Redirect } from 'expo-router';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { errorMessage } from '@/api/errors';
import { getToken } from '@/api/tokenStorage';
import { ActivityRow } from '@/components/ActivityRow';
import { Button } from '@/components/Button';
import { ErrorBanner } from '@/components/ErrorBanner';
import { colors, fontSize, spacing } from '@/constants/theme';
import { useActivity } from '@/hooks/useActivity';

export default function ActivityScreen() {
  const { items, nextCursor, loading, refreshing, loadingMore, error, moreError, loadMore, refresh, retry } =
    useActivity();

  if (!getToken()) return <Redirect href="/token" />;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.muted}>Loading activity…</Text>
      </View>
    );
  }

  if (error && items.length === 0) {
    return (
      <View style={styles.content}>
        <ErrorBanner message={errorMessage(error)} onAction={retry} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ActivityRow item={item} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      onEndReached={moreError ? undefined : loadMore}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={
        <View style={styles.header}>
          {error ? <ErrorBanner message={`Couldn't refresh. ${errorMessage(error)}`} onAction={refresh} /> : null}
          <Button title="Refresh" variant="secondary" onPress={refresh} loading={refreshing} />
        </View>
      }
      ListEmptyComponent={<Text style={styles.muted}>No activity yet.</Text>}
      ListFooterComponent={
        moreError ? (
          <ErrorBanner message={`Couldn't load more. ${errorMessage(moreError)}`} onAction={loadMore} />
        ) : nextCursor ? (
          <Button title="Load more" variant="secondary" onPress={loadMore} loading={loadingMore} />
        ) : items.length > 0 ? (
          <Text style={styles.muted}>No more activity.</Text>
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  list: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.sm },
  header: { gap: spacing.sm },
  muted: { color: colors.textMuted, fontSize: fontSize.md, textAlign: 'center', paddingVertical: spacing.md },
});
