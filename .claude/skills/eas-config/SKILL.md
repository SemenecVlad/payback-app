---
name: eas-config
description: Reference and procedures for Expo Application Services configuration - eas.json build/submit profiles, app.json / app.config dynamic config, environment variables and secrets, build variants (dev/preview/production with different bundle IDs), development builds, OTA updates with channels and runtimeVersion. Use when editing eas.json or app config, setting up EAS builds or updates, or debugging why an EAS build or update behaves differently from local.
---

# EAS & app config

## 0. Detect

```bash
node ~/.claude/skills/rn-conventions/scripts/detect-stack.js 2>/dev/null || node .claude/skills/rn-conventions/scripts/detect-stack.js
```

Not an Expo project (`versions.expo` null) → EAS Build still works with bare RN, but app-config sections below don't apply; say so.

Read `eas.json` and the app config (`appConfig` in the report) in full before changing them. EAS CLI options evolve — when unsure about a key, check `eas build --help`, `eas update --help`, or the Expo docs for the installed `eas-cli` version (`eas --version`; `cli.version` in `eas.json` pins the required range).

## 1. eas.json — typical shape

```json
{
  "cli": { "version": ">= 16.0.0", "appVersionSource": "remote" },
  "build": {
    "base": { "node": "22.x" },
    "development": {
      "extends": "base",
      "developmentClient": true,
      "distribution": "internal",
      "environment": "development",
      "channel": "development"
    },
    "preview": {
      "extends": "base",
      "distribution": "internal",
      "environment": "preview",
      "channel": "preview"
    },
    "production": {
      "extends": "base",
      "environment": "production",
      "channel": "production",
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": { "ascAppId": "<App Store Connect app id>" },
      "android": { "track": "internal" }
    }
  }
}
```

Key points:
- `appVersionSource: "remote"` → EAS owns build numbers (`buildNumber` / `versionCode`); with `autoIncrement` they bump per build. `"local"` → they come from app config and you bump them yourself.
- `extends` to share settings between profiles.
- `distribution: "internal"` → ad-hoc/APK builds for testers; production builds go to the stores.
- `channel` links a build to an OTA update channel.
- iOS simulator builds: `"ios": { "simulator": true }` in a profile.
- Android APK instead of AAB for internal testing: `"android": { "buildType": "apk" }`.
- Never put secrets in `eas.json` — it's committed.

## 2. Environment variables & secrets

- Prefer EAS environment variables (`eas env:create`, `eas env:list --environment production`), scoped per environment (`development` / `preview` / `production`) and linked from the build profile via `environment`.
- Visibility: `plain text` / `sensitive` / `secret`. Values needed by JS at runtime are **embedded in the bundle** — they're never truly secret on device. Real secrets (private API keys) belong on a server.
- In app code only `process.env.EXPO_PUBLIC_*` variables are inlined into the JS bundle. Others are available in `app.config.*` at build time (to configure plugins, bundle IDs, etc.) but not in app code.
- Local dev: `.env` / `.env.local` (gitignored) with `EXPO_PUBLIC_*`; `eas env:pull` to sync.
- `.env*` files (except `.env.example` etc.) are protected by a hook: Claude can't read or edit them. To learn variable names use `.env.example`, `eas env:list`, or grep the code for `process.env.`; to change values, tell the user exactly which line to add.
- "Works locally, broken on EAS" → the variable exists in local `.env` but not in the EAS environment for that profile, or a file it needs is excluded by `.gitignore` / `.easignore`.

## 3. Dynamic app config — variants

Use `app.config.ts` to install dev/preview/prod side by side:

```ts
import type { ExpoConfig, ConfigContext } from 'expo/config';

const VARIANT = process.env.APP_VARIANT ?? 'production'; // set per profile via EAS env vars
const suffix = VARIANT === 'production' ? '' : `.${VARIANT}`;
const nameSuffix = VARIANT === 'production' ? '' : ` (${VARIANT})`;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config, // keeps values from app.json if both exist
  name: `MyApp${nameSuffix}`,
  slug: 'myapp',
  ios: { ...config.ios, bundleIdentifier: `com.example.myapp${suffix}` },
  android: { ...config.android, package: `com.example.myapp${suffix}` },
});
```

Adapt names/IDs to the project — never change the **production** bundle ID / package of a published app.

## 4. Development builds

Needed as soon as the app uses native code outside Expo Go (custom native modules, config plugins).
```bash
npx expo install expo-dev-client
eas build --profile development --platform ios   # or android
npx expo start --dev-client
```
Rebuild the dev client whenever native dependencies or native-affecting app config change; JS changes don't need a rebuild.

## 5. OTA updates (expo-updates)

- `runtimeVersion` decides which binaries can receive an update. Policies: `{ "policy": "appVersion" }` (simple, bump app version on every native change), `{ "policy": "fingerprint" }` (automatic from native state — safest), or a manual string.
- Publish: `eas update --channel <channel> --message "<msg>"` (`--environment <env>` so the right EAS env vars are embedded).
- Rollback / republish: `eas update:republish` or `eas update:rollback` (check `--help` for the installed version).
- **Never** ship JS that needs new native code via OTA — it will crash old binaries. Native change ⇒ new store build + new runtime.

## 6. Common commands

```bash
eas whoami
eas build:configure                     # creates eas.json
eas build -p ios|android|all --profile <p>
eas build:list --limit 5
eas submit -p ios|android --latest --profile <p>
eas credentials                         # manage signing (interactive)
eas env:list --environment <env>
eas update --channel <c> --message "…"
eas update:list --branch <b>
npx expo config --type public           # print the resolved app config (great for debugging dynamic config)
npx expo-doctor
```

Interactive commands (`eas credentials`, first `eas build` without credentials) need the user at the terminal — explain what to answer instead of running them.

Read-only commands (`build:list`, `update:list`, `env:list`, `whoami`, `config`) run freely. Commands that change cloud state (`build`, `submit`, `update`, `env:create`, `channel:edit`, credentials…) trigger a confirmation prompt from a hook — that's expected; propose the exact command and let the user approve it.

## Output

When changing config: show the diff of `eas.json` / app config, explain each change in one line, and give the exact commands to build/test it. Validate the result with `npx expo config --type public` (app config) and by checking `eas.json` is valid JSON.
