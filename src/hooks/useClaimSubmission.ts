import { useCallback, useState } from 'react';

import { createClaim } from '@/api/claims';
import { delay, retryDelayMs } from '@/api/client';
import { ApiError, errorMessage, isRetryable } from '@/api/errors';
import { CreateClaimRequest } from '@/types/api';
import { newIdempotencyKey } from '@/utils/idempotencyKey';

import {
  ClaimIntent,
  getUnresolvedIntent,
  isIntentExpired,
  sameRequest,
  setUnresolvedIntent,
} from './claimIntent';
import { trackClaim } from './localClaims';

/** Automatic repeats of the same POST (same key) before asking the user. */
const SUBMIT_RETRIES = 3;

export type SubmissionState =
  | { phase: 'idle' }
  | { phase: 'submitting'; checking: boolean }
  | { phase: 'unknown'; request: CreateClaimRequest }
  | { phase: 'expired'; intent: ClaimIntent }
  | { phase: 'rejected'; message: string }
  | { phase: 'submitted'; claimId: string };

/**
 * The outcome is unknown when the request may have reached the server: timeout, network error, 5xx,
 * 429, or a 2xx we couldn't read. Only then is the same request repeated with the same key.
 */
function outcomeUnknown(error: unknown): boolean {
  return isRetryable(error) || (error instanceof ApiError && error.kind === 'bad_response');
}

function initialState(): SubmissionState {
  const intent = getUnresolvedIntent();
  if (!intent) return { phase: 'idle' };
  return isIntentExpired(intent, Date.now()) ? { phase: 'expired', intent } : { phase: 'unknown', request: intent.request };
}

export function useClaimSubmission() {
  const [state, setState] = useState<SubmissionState>(initialState);

  const submit = useCallback(async (request: CreateClaimRequest) => {
    const existing = getUnresolvedIntent();
    if (existing && isIntentExpired(existing, Date.now())) {
      // Re-sending an expired key could create a second claim; the user has to check manually.
      setState({ phase: 'expired', intent: existing });
      return;
    }
    const intent =
      existing && sameRequest(existing.request, request)
        ? existing
        : { request, key: newIdempotencyKey(), createdAt: Date.now() };
    setUnresolvedIntent(intent);
    setState({ phase: 'submitting', checking: intent === existing });

    for (let attempt = 0; ; attempt++) {
      try {
        const claim = await createClaim(intent.request, intent.key);
        setUnresolvedIntent(null);
        trackClaim(claim);
        setState({ phase: 'submitted', claimId: claim.id });
        return;
      } catch (error) {
        if (!outcomeUnknown(error)) {
          // A definite answer (e.g. 400 validation): no claim was created with this key.
          setUnresolvedIntent(null);
          setState({ phase: 'rejected', message: errorMessage(error) });
          return;
        }
        if (attempt >= SUBMIT_RETRIES) {
          setState({ phase: 'unknown', request: intent.request });
          return;
        }
        setState({ phase: 'submitting', checking: true });
        await delay(retryDelayMs(error, attempt));
      }
    }
  }, []);

  const reset = useCallback(() => setState({ phase: 'idle' }), []);

  /** For an expired intent only: the user acknowledged they will check the outcome themselves. */
  const dismissExpired = useCallback(() => {
    setUnresolvedIntent(null);
    setState({ phase: 'idle' });
  }, []);

  return { state, submit, reset, dismissExpired };
}
