import { API_BASE_URL, GET_RETRY_ATTEMPTS, REQUEST_TIMEOUT_MS } from './config';
import { ApiError, ApiErrorKind, isRetryable } from './errors';
import { getToken } from './tokenStorage';

export type ApiResponse = { status: number; body: unknown; headers: Headers };

type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
  headers?: Record<string, string>;
};

const KIND_BY_CODE: Record<string, ApiErrorKind> = {
  VALIDATION: 'validation',
  UNAUTHORIZED: 'unauthorized',
  NOT_FOUND: 'not_found',
  IDEMPOTENCY_MISMATCH: 'idempotency_mismatch',
  RATE_LIMITED: 'rate_limited',
  SERVER: 'server',
  TIMEOUT: 'timeout',
};

function kindFromStatus(status: number): ApiErrorKind {
  if (status === 400) return 'validation';
  if (status === 401) return 'unauthorized';
  if (status === 404) return 'not_found';
  if (status === 409) return 'idempotency_mismatch';
  if (status === 429) return 'rate_limited';
  if (status === 504) return 'timeout';
  return 'server';
}

function parseJson(text: string): unknown {
  if (text === '') return null;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function toApiError(status: number, body: unknown, headers: Headers): ApiError {
  const error = typeof body === 'object' && body !== null && 'error' in body ? body.error : null;
  const details = typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : {};
  const code = typeof details.code === 'string' ? details.code : '';
  const message = typeof details.message === 'string' ? details.message : `Request failed (${status})`;
  const retryAfterHeader = Number(headers.get('Retry-After'));
  const retryAfterMs =
    typeof details.retryAfterMs === 'number'
      ? details.retryAfterMs
      : Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
        ? retryAfterHeader * 1000
        : null;

  return new ApiError(KIND_BY_CODE[code] ?? kindFromStatus(status), message, {
    status,
    field: typeof details.field === 'string' ? details.field : null,
    retryAfterMs,
  });
}

/** One HTTP request, no retries. Every failure becomes an ApiError. */
export async function apiRequest(path: string, options: RequestOptions = {}): Promise<ApiResponse> {
  const token = getToken();
  if (!token) throw new ApiError('unauthorized', 'No token');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw controller.signal.aborted
      ? new ApiError('timeout', 'Request timed out')
      : new ApiError('network', 'Network error');
  } finally {
    clearTimeout(timer);
  }

  let text: string;
  try {
    text = await response.text();
  } catch {
    throw new ApiError('network', 'Connection lost while reading the response', { status: response.status });
  }
  const body = parseJson(text);

  if (!response.ok) throw toApiError(response.status, body, response.headers);
  if (body === undefined) throw new ApiError('bad_response', 'Response is not JSON', { status: response.status });
  return { status: response.status, body, headers: response.headers };
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Waiting time before retry number `attempt` (0-based): honours retryAfterMs, otherwise exponential backoff. */
export function retryDelayMs(error: unknown, attempt: number): number {
  if (error instanceof ApiError && error.retryAfterMs !== null) return error.retryAfterMs;
  return 500 * 2 ** attempt;
}

/** GET with retries on transient failures (safe: GETs have no side effects). */
export async function apiGet(path: string): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    try {
      return (await apiRequest(path)).body;
    } catch (error) {
      if (attempt >= GET_RETRY_ATTEMPTS || !isRetryable(error)) throw error;
      await delay(retryDelayMs(error, attempt));
    }
  }
}
