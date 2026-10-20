# Payback

A slice of a crypto cashback app: see payback balances and claim them. Expo + TypeScript, shipped as a
web build for phones (~390px wide).

**Live:** [LIVE_URL](https://payback-app-pied.vercel.app/)

On first open the app asks for your API token. It is kept only in this browser (localStorage) and can be
changed from the link at the bottom of the home screen. The token is never in the code, the repo or the build.

## What works

- **Home:** balances per asset (available, pending, being claimed), total available in USD, how fresh
  the data is ("Updated 12 s ago"), loading, error with retry, empty state, refresh button,
  auto-refresh every 15 s.
- **Claim:** pick an asset, type an amount or tap Max, pick a destination, see the fee and what you'll
  receive, review and confirm, then follow the claim until it is completed or failed.
  - Input is validated against the API rules: format, the asset's decimals, minimum, available, more than the fee.
  - After submitting, the balance drops right away and doesn't jump back (see NOTES.md, decision 2).
  - If the result is unknown (timeout, network error, 5xx), the same request is retried with the same
    Idempotency-Key, so no duplicate claim is possible; the app says "don't claim again" and survives a reload.
- **Tests:** amount parsing, validation, fee, USD totals, rounding, the balance overlay, the API client's
  error handling, and persisting an unconfirmed claim.

Not built: Activity (history with pagination). See NOTES.md for known issues.

## Run locally

Requires Node 20+.

```bash
npm install
npx expo start --web    # open the printed URL, narrow the window to ~390px or use device mode
```

```bash
npm test                # jest (no network: fetch is mocked)
npx tsc --noEmit        # typecheck
npx eslint src          # lint
```

## Build and deploy

```bash
npx expo export -p web  # static single-page build in dist/
```

Deployed on Vercel from the repo root: build command `npx expo export -p web`, output directory `dist`.
`vercel.json` rewrites every path to `index.html` so routes work on refresh.

## Structure

- `src/app/` routes (expo-router): `index` (home), `claim`, `token`
- `src/api/` the only code that talks to the network; response validation, typed errors, token storage
- `src/money/` exact decimal math on BigInt, input parsing, claim validation, USD totals, formatting
- `src/hooks/` data loading, claim submission, claim tracking, the unconfirmed-claim store
- `src/components/` UI pieces; `src/utils/` pure helpers; `src/types/` API types

API docs: https://task-api.cashmine.io/docs
