import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '@/constants/theme';
import { isPolling, trackClaim, useLocalClaims } from '@/hooks/localClaims';
import { SubmissionState } from '@/hooks/useClaimSubmission';
import { useNow } from '@/hooks/useNow';
import { formatAmount } from '@/money/format';
import { Claim } from '@/types/api';

import { Button } from './Button';
import { SummaryRows } from './SummaryRows';

const SLOW_AFTER_MS = 30_000;

type ClaimProgressProps = {
  state: Exclude<SubmissionState, { phase: 'idle' } | { phase: 'rejected' }>;
  onCheckAgain: () => void;
  onDismissExpired: () => void;
};

function Panel({ tone, title, body }: { tone: 'info' | 'success' | 'warning' | 'danger'; title: string; body?: string }) {
  return (
    <View style={[styles.panel, styles[tone]]} accessibilityRole="alert">
      <Text style={styles.title}>{title}</Text>
      {body && <Text style={styles.body}>{body}</Text>}
    </View>
  );
}

function ClaimDetails({ claim }: { claim: Claim }) {
  return (
    <SummaryRows
      rows={[
        { label: 'Amount', value: `${formatAmount(claim.amount)} ${claim.asset}` },
        { label: 'Fee', value: `${formatAmount(claim.fee)} ${claim.asset}` },
        { label: 'You receive', value: `${formatAmount(claim.receiveAmount)} ${claim.asset}`, strong: true },
      ]}
    />
  );
}

function SubmittedClaim({ claim }: { claim: Claim }) {
  const now = useNow();
  const slow = now - Date.parse(claim.createdAt) > SLOW_AFTER_MS;

  if (claim.status === 'completed') {
    return <Panel tone="success" title="Claim completed" body="The payback has been sent to your destination." />;
  }
  if (claim.status === 'failed') {
    return (
      <Panel
        tone="danger"
        title="Claim failed"
        body={`${claim.failureReason ?? 'No reason given.'} The amount is back in your available balance.`}
      />
    );
  }
  return (
    <>
      <Panel
        tone={slow ? 'warning' : 'info'}
        title={slow ? 'Taking longer than usual' : 'Claim submitted, waiting for confirmation'}
        body="It is already deducted from your available balance. No need to claim again."
      />
      {isPolling(claim.id) ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Button title="Check status" variant="secondary" onPress={() => trackClaim(claim)} />
      )}
    </>
  );
}

export function ClaimProgress({ state, onCheckAgain, onDismissExpired }: ClaimProgressProps) {
  const claims = useLocalClaims();
  const claim = state.phase === 'submitted' ? claims.find((c) => c.id === state.claimId) : undefined;

  return (
    <View style={styles.container}>
      {state.phase === 'submitting' && (
        <>
          <Panel
            tone="info"
            title={state.checking ? 'Checking your claim…' : 'Submitting your claim…'}
            body="Please keep this page open."
          />
          <ActivityIndicator color={colors.primary} />
        </>
      )}
      {state.phase === 'unknown' && (
        <>
          <Panel
            tone="warning"
            title="We couldn't confirm your claim"
            body={`Your claim of ${formatAmount(state.request.amount)} ${state.request.asset} may still go through. Don't claim again — tap "Check again" to find out.`}
          />
          <Button title="Check again" onPress={onCheckAgain} />
        </>
      )}
      {state.phase === 'expired' && (
        <>
          <Panel
            tone="danger"
            title="We can't safely re-check this claim"
            body={`Your claim of ${formatAmount(state.intent.request.amount)} ${state.intent.request.asset} from ${new Date(state.intent.createdAt).toLocaleString()} was never confirmed, and it's too late to check it from here. Before claiming again, look at your balance: if the amount left your available balance, the claim went through.`}
          />
          <Button title="I've checked, dismiss" variant="secondary" onPress={onDismissExpired} />
        </>
      )}
      {claim && (
        <>
          <SubmittedClaim claim={claim} />
          <ClaimDetails claim={claim} />
        </>
      )}
      <Button title="Back to balances" variant="secondary" onPress={() => router.replace('/')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  panel: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md },
  info: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  success: { backgroundColor: colors.successSurface },
  warning: { backgroundColor: colors.warningSurface },
  danger: { backgroundColor: colors.dangerSurface },
  title: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text },
  body: { fontSize: fontSize.md, color: colors.text },
});
