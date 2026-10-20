# Notes

## Decisions

### 1. Amount representation — BigInt fixed-point (`src/money/`)
Amounts are parsed from the API's decimal strings into `{ units: bigint, scale }` and all math
(fee, receive amount, comparisons, USD totals) is done on BigInt. Floats are never used.
USD total is summed exactly and rounded once, half up, to cents for display.
- Alternatives: a decimal library (`big.js`) — well tested, but another dependency to audit for web,
  we'd still write strict input parsing, and `toNumber()` is one call away; keeping strings and doing
  no client math — can't show fee/receive or validate min/available.
- Why: exact, zero dependencies, small enough to fully unit-test.

### 2. Balance right after a claim — optimistic overlay reconciled by `asOf`
After a 201 the asset's `available` is shown reduced by the claim amount, with a "claiming" row.
The local adjustment is dropped only when a snapshot arrives with `asOf >= claim.createdAt`
(that snapshot already includes the claim), so the number never jumps back. If the claim fails,
the amount returning is shown with the failure reason.
- Alternatives: server numbers only + "claim in progress" badge and blocking a second claim
  (simplest, but available looks unchanged for up to 15 s); server numbers + a separate
  "≈ after claim" line (honest, but two numbers on a small screen, same amount of code).
- Why: addresses both complaints ("didn't change, claimed again" and "dropped then jumped back").

### 3. Unknown claim result (504 / network / 5xx / timeout)
One Idempotency-Key per confirmed claim, reused for every retry; the form is locked while the
outcome is unknown. The app shows "Checking your claim…", retries the same POST with the same key
(the API replays the original claim, never creates a duplicate), honours `retryAfterMs` on 429, and
if still unknown shows "Don't claim again, it may still go through" with a "Check again" button.
With a claim id, it polls `GET /v1/claims/{id}` until completed/failed.

### Other assumptions
- USD total = value of `available` only; `pending` and `claiming` are shown per asset but not in the total.
- In the amount field a comma is read as the decimal separator; thousands separators are rejected.
  Risk: "1,000" means 1.000, not one thousand — the confirm step shows the parsed amount before submitting.
- Routes live in `src/app/` (expo-router template); AGENTS.md mentions both `app/` and `src/app/`.

## Working with AI

## Not done / known issues
