import { apiGet, apiRequest } from './client';
import { ApiError, isOutcomeUnknown } from './errors';
import { getToken } from './tokenStorage';

jest.mock('./tokenStorage', () => ({ getToken: jest.fn() }));

const mockedGetToken = getToken as jest.MockedFunction<typeof getToken>;
const fetchMock = jest.fn();

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

beforeEach(() => {
  mockedGetToken.mockReturnValue('test-token');
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
});

async function captureError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected the request to fail');
}

describe('apiRequest', () => {
  it('sends the bearer token and returns the parsed body', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    const response = await apiRequest('/v1/balances');
    expect(response.body).toEqual({ ok: true });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer test-token');
  });

  it('fails without a token and does not call the network', async () => {
    mockedGetToken.mockReturnValue(null);
    const error = await captureError(apiRequest('/v1/balances'));
    expect(error.kind).toBe('unauthorized');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps the error body code and field', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, { error: { code: 'VALIDATION', message: 'Amount too small', field: 'amount' } }),
    );
    const error = await captureError(apiRequest('/v1/claims', { method: 'POST', body: {} }));
    expect(error).toMatchObject({ kind: 'validation', message: 'Amount too small', field: 'amount', status: 400 });
  });

  it('treats 504 as an unknown outcome', async () => {
    fetchMock.mockResolvedValue(jsonResponse(504, { error: { code: 'TIMEOUT', message: 'Timed out' } }));
    const error = await captureError(apiRequest('/v1/claims', { method: 'POST', body: {} }));
    expect(error.kind).toBe('timeout');
    expect(isOutcomeUnknown(error)).toBe(true);
  });

  it('treats a network failure as an unknown outcome', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const error = await captureError(apiRequest('/v1/claims', { method: 'POST', body: {} }));
    expect(error.kind).toBe('network');
    expect(isOutcomeUnknown(error)).toBe(true);
  });

  it('reads retryAfterMs from a 429', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(429, { error: { code: 'RATE_LIMITED', message: 'Too many requests', retryAfterMs: 2300 } }),
    );
    const error = await captureError(apiRequest('/v1/balances'));
    expect(error).toMatchObject({ kind: 'rate_limited', retryAfterMs: 2300 });
  });

  it('rejects a non-JSON success body', async () => {
    fetchMock.mockResolvedValue(new Response('<html>', { status: 200 }));
    const error = await captureError(apiRequest('/v1/balances'));
    expect(error.kind).toBe('bad_response');
  });
});

describe('apiGet', () => {
  it('retries transient failures, then succeeds', async () => {
    jest.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(503, { error: { code: 'SERVER', message: 'down' } }))
      .mockResolvedValueOnce(jsonResponse(200, { items: [] }));
    const promise = apiGet('/v1/balances');
    await jest.runAllTimersAsync();
    await expect(promise).resolves.toEqual({ items: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('does not retry a 401', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'bad token' } }));
    const error = await captureError(apiGet('/v1/balances'));
    expect(error.kind).toBe('unauthorized');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
