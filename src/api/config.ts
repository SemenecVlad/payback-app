export const API_BASE_URL = 'https://task-api.cashmine.io';

export const REQUEST_TIMEOUT_MS = 15_000;

/** GET requests are retried on transient failures; POST /claims has its own retry logic (idempotency key). */
export const GET_RETRY_ATTEMPTS = 2;
