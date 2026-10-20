import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';

import { errorMessage } from '@/api/errors';
import { colors, fontSize, radius, spacing } from '@/constants/theme';
import { useClaimOptions } from '@/hooks/useClaimOptions';
import { useClaimSubmission } from '@/hooks/useClaimSubmission';
import { checkClaimAmount, ClaimRules, maxClaimInput } from '@/money/claimAmount';
import { formatAmount } from '@/money/format';
import { Balance } from '@/types/api';

import { Button } from './Button';
import { ChipSelect } from './ChipSelect';
import { ClaimProgress } from './ClaimProgress';
import { ErrorBanner } from './ErrorBanner';
import { SummaryRows } from './SummaryRows';

/** Mount with `key={balance.asset}`. */
export function ClaimForm({ balance }: { balance: Balance }) {
  const { options, error, loading, retry } = useClaimOptions(balance.asset);
  const { state, submit, reset, dismissExpired } = useClaimSubmission();
  const [input, setInput] = useState('');
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (state.phase !== 'idle' && state.phase !== 'rejected') {
    return (
      <ClaimProgress
        state={state}
        onCheckAgain={() => state.phase === 'unknown' && submit(state.request)}
        onDismissExpired={dismissExpired}
      />
    );
  }
  if (loading) return <ActivityIndicator color={colors.primary} />;
  if (!options) return <ErrorBanner message={errorMessage(error)} onAction={retry} />;

  const rules: ClaimRules = {
    asset: balance.asset,
    decimals: balance.decimals,
    available: balance.available,
    minAmount: options.minAmount,
    fee: options.fee,
  };
  const check = checkClaimAmount(input, rules);
  const maxInput = maxClaimInput(rules);
  const destination = options.destinations.find((dest) => dest.id === destinationId) ?? options.destinations[0];
  const unit = (value: Parameters<typeof formatAmount>[0]) => `${formatAmount(value)} ${balance.asset}`;

  if (!destination) return <ErrorBanner message="No destination is available for this asset." />;

  if (confirming && check.ok) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Confirm your claim</Text>
        <SummaryRows
          rows={[
            { label: 'Amount', value: unit(check.amount) },
            { label: 'Fee', value: unit(options.fee) },
            { label: 'You receive', value: unit(check.receive), strong: true },
            { label: 'To', value: destination.label },
          ]}
        />
        <Button
          title="Confirm claim"
          onPress={() => submit({ asset: balance.asset, amount: check.amount, destinationId: destination.id })}
        />
        <Button title="Edit" variant="secondary" onPress={() => setConfirming(false)} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {state.phase === 'rejected' && <ErrorBanner message={`Claim not created: ${state.message}`} />}
      <Text style={styles.muted}>
        Available: {unit(balance.available)} · Minimum: {unit(options.minAmount)}
      </Text>
      <View style={styles.amountRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={(text) => {
            setInput(text);
            if (state.phase === 'rejected') reset();
          }}
          placeholder="0.00"
          placeholderTextColor={colors.textMuted}
          inputMode="decimal"
          keyboardType="decimal-pad"
          autoCorrect={false}
          accessibilityLabel={`Amount in ${balance.asset}`}
        />
        <Button title="Max" variant="secondary" disabled={!maxInput} onPress={() => maxInput && setInput(maxInput)} />
      </View>
      {!maxInput && <Text style={styles.error}>Your available balance is below the minimum claim.</Text>}
      {input !== '' && !check.ok && <Text style={styles.error}>{check.message}</Text>}

      {options.destinations.length > 1 && (
        <ChipSelect options={options.destinations} selectedId={destination.id} onSelect={setDestinationId} />
      )}
      <SummaryRows
        rows={[
          { label: 'Fee', value: unit(options.fee) },
          { label: 'You receive', value: check.ok ? unit(check.receive) : '—', strong: true },
          { label: 'To', value: destination.label },
        ]}
      />
      <Button title="Review claim" disabled={!check.ok} onPress={() => setConfirming(true)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  heading: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text },
  muted: { fontSize: fontSize.sm, color: colors.textMuted },
  amountRow: { flexDirection: 'row', gap: spacing.sm },
  input: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.lg,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  error: { color: colors.danger, fontSize: fontSize.sm },
});
