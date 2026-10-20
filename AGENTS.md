This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

## Code style

- TypeScript strict. No `any`, no `@ts-ignore`. Types come from the API docs.
- Function components and hooks only. Named exports, except where expo-router needs a default export.
- `StyleSheet.create`, no inline style objects in render. Colors and spacing in one theme file.
- Small components: past ~150 lines, split.
- No dead code, no commented-out code, no stray `console.log`.
- Clear names over comments; comment only the non-obvious why.
- Libraries must support web. Check before adding (install with `npx expo install <pkg>`).
- Use RN primitives (`Pressable`, `FlatList`, `TextInput`…), not DOM elements. Respect safe areas.

Run lint and typecheck before declaring any task done.

## UX states

Every screen that loads data handles loading, error (with retry), empty and refresh. Errors are shown in readable words, never swallowed.

## Tests

- jest-expo + @testing-library/react-native.
- Amount logic first (it's required), then the API layer and claim-state logic, then screens if time allows.
- Mock the network; tests never hit the real API and never contain the real token.
- Tests and `tsc --noEmit` pass before any commit.

## Git

- Conventional Commits: `type: description` — `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `style`. Lowercase, imperative, no period, under ~70 chars.
- Small focused commits, at least every 30 minutes. Never squash or rewrite history.
- Never commit `.env`, tokens or `dist/`.

## Deliverables besides the app

- `README.md`: live link, how to run locally, what works.
- `NOTES.md` (~1 page): Decisions · Working with AI (3 moments with pointers into `ai-logs/`) · Not done / known issues.
- `ai-logs/`: AI conversations, untidied, with the token and private data removed.

## API

- Docs: https://task-api.cashmine.io/docs — the source of truth. Read the relevant part before implementing anything that touches the API. Don't invent endpoints, fields, formats or rules; if the docs are unclear, ask.
- Treat the API as a real remote server we can't change: it can be slow, fail, time out or return unexpected data.
- Base URL lives in one place: `src/api/config.ts`.
- **The token is never in code, env files, tests, logs, the repo or the build.** The user enters it on first open (a text field), it's kept in the browser (`localStorage`, behind `src/api/tokenStorage.ts`), and there's a way to change it.
- To call the real API from the shell, use `$CASHMINE_TOKEN` (exported by the user in their terminal). Never print, echo or paste its value.

## Money

- Never use JS floats for amounts — not for parsing, math, comparison or rounding.
- Representation: decide once, explicitly (it's a documented decision in NOTES.md), and use it everywhere via `src/money/`. Follow the API docs for formats, precision per asset, minimums, fees and rounding.
- Parse user input strictly (locale separators, leading/trailing junk, too many decimals, negative, zero, above available balance).
- Format for display in one place.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md


