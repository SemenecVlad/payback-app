import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text } from 'react-native';

import { errorMessage } from '@/api/errors';
import { getToken } from '@/api/tokenStorage';
import { ChipSelect } from '@/components/ChipSelect';
import { ClaimForm } from '@/components/ClaimForm';
import { ErrorBanner } from '@/components/ErrorBanner';
import { colors, fontSize, spacing } from '@/constants/theme';
import { useBalances } from '@/hooks/useBalances';

export default function ClaimScreen() {
  const params = useLocalSearchParams<{ asset?: string }>();
  const { snapshot, error, loading, retry } = useBalances();
  const [asset, setAsset] = useState<string | null>(params.asset ?? null);

  if (!getToken()) return <Redirect href="/token" />;

  const balance = snapshot?.items.find((item) => item.asset === asset);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {loading && <ActivityIndicator color={colors.primary} />}
      {!snapshot && error ? <ErrorBanner message={errorMessage(error)} onAction={retry} /> : null}
      {snapshot && (
        <>
          <Text style={styles.label}>Asset</Text>
          <ChipSelect
            options={snapshot.items.map((item) => ({ id: item.asset, label: item.asset }))}
            selectedId={asset}
            onSelect={setAsset}
          />
          {balance ? (
            <ClaimForm key={balance.asset} balance={balance} />
          ) : (
            <Text style={styles.label}>Choose an asset to claim.</Text>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md },
  label: { fontSize: fontSize.md, color: colors.textMuted },
});
