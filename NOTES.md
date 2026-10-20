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
The unresolved request (body + key + time of first send) is kept in localStorage, so a reload or leaving
the screen doesn't lose the key; Home shows a "not confirmed yet" banner. It is cleared on a definite
answer (2xx with a claim, or 4xx) and when the token changes (re-sending under another token would
create a real claim there).
- Key lifetime: 24 h (given by the product owner, not in the API docs). The app re-sends only within
  23 h of the first send (1 h margin for clock drift); after that it doesn't POST and asks the user to
  check their balance, because an expired key could create a second claim.

### Other assumptions
- USD total = value of `available` only; `pending` and `claiming` are shown per asset but not in the total.
- In the amount field a comma is read as the decimal separator; thousands separators are rejected.
  Risk: "1,000" means 1.000, not one thousand — the confirm step shows the parsed amount before submitting.
- Routes live in `src/app/` (expo-router template); AGENTS.md mentions both `app/` and `src/app/`.

## Working with AI

Logs: `ai-logs/` (ai-conversation-log.txt).

1. **The docs summary invented a section.** The first read of the API docs went through a web-fetch
   summariser, which added a "Notes and Gaps" section (e.g. "fee rounding is not specified") that is not
   in the docs. I caught it by re-reading the raw page with curl, and planned only from that.
   Takeaway: for the source of truth, read the raw text, not a summary.
2. **Reload lost the Idempotency-Key.** The first version kept the unconfirmed claim's key in memory and
   listed "lost on reload" as a known risk. I asked for protection; the key, body and send time are now in
   localStorage. I then told the AI the key lifetime (24 h, not in the docs); it added a 23 h re-send
   window and a "can't safely re-check" state instead of re-sending an expired key.
3. **Wrong deploy command, self-corrected.** The AI first suggested `vercel deploy dist`, which would have
   dropped `vercel.json` (it lives in the repo root, not in `dist/`), so routes would 404 on refresh.
   It noticed and corrected it before the deploy: deploy from the root with build/output settings.

## Not done / known issues

- **Activity screen** (history with pagination) was not built.
- **Claim list and balance overlay are in memory.** After a reload *after* a successful submit, "Your
  claims" is empty and for up to 15 s (until the next snapshot) available may look unchanged. The
  unconfirmed-request state (before we know the claim id) *is* persisted.
- **Expired unconfirmed claim:** after 23 h the app can't check the outcome itself (the API has no
  lookup by Idempotency-Key); the user is asked to check their balance. The 23 h check uses the
  device clock.
- **Claim status polling** stops after 3 min; the user can restart it with "Check status".
- **Max** uses the snapshot's `available` (up to 15 s old); the server checks the live value, so at worst
  Max is lower than possible or the server rejects with a readable message.
- **Comma input:** "1,000" is read as 1.000 (comma = decimal separator). The confirm step shows the
  parsed amount before anything is sent.
- **Auto-refresh keeps running after a 401** (wasted requests; the banner asks to change the token).
- **Pull-to-refresh** does nothing on web; the Refresh button covers it.
- **"Updated X s ago"** compares server `asOf` with the device clock.
- **Tests:** no tests yet for the submission hook (retry → unknown → replay) or for the screens; the
  retry logic is reviewed by hand.
- **USD total** is available only; pending and claiming are shown per asset but not totalled.
- `npx expo lint` fails its own ESLint version check in this setup; `npx eslint src` works and is clean.
