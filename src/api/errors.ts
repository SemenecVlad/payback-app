export type ApiErrorKind =
  | 'validation'
  | 'unauthorized'
  | 'not_found'
  | 'idempotency_mismatch'
  | 'rate_limited'
  | 'server'
  | 'timeout'
  | 'network'
  | 'bad_response';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly field: string | null;
  readonly retryAfterMs: number | null;

  constructor(
    kind: ApiErrorKind,
    message: string,
    options: { status?: number | null; field?: string | null; retryAfterMs?: number | null } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = options.status ?? null;
    this.field = options.field ?? null;
    this.retryAfterMs = options.retryAfterMs ?? null;
  }
}

/** The request may or may not have been processed by the server (docs: 504 = outcome unknown). */
export function isOutcomeUnknown(error: unknown): boolean {
  return error instanceof ApiError && (error.kind === 'timeout' || error.kind === 'network' || error.kind === 'server');
}

export function isRetryable(error: unknown): boolean {
  return isOutcomeUnknown(error) || (error instanceof ApiError && error.kind === 'rate_limited');
}

/** Readable text for the UI. */
export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Something went wrong. Please try again.';
  switch (error.kind) {
    case 'unauthorized':
      return 'Your token is missing, invalid or expired. Please enter it again.';
    case 'rate_limited':
      return 'Too many requests. Please wait a moment and try again.';
    case 'server':
      return 'The server had a temporary problem. Please try again.';
    case 'timeout':
      return 'The server took too long to respond.';
    case 'network':
      return 'Could not reach the server. Check your connection.';
    case 'bad_response':
      return 'The server sent data we could not read.';
    case 'not_found':
      return 'Not found.';
    case 'validation':
    case 'idempotency_mismatch':
      return error.message;
  }
}
