---
name: expo-upgrade
description: Upgrades an Expo project to a newer Expo SDK (or a bare React Native project to a newer RN version) step by step — breaking-change review, dependency alignment, native regeneration, config migration and verification. Use when asked to upgrade Expo SDK, React Native, or fix SDK-version dependency mismatches. Optional argument - target SDK, e.g. /expo-upgrade 55.
disable-model-invocation: true
---

# Expo SDK / React Native upgrade

Target: `$ARGUMENTS` (an SDK number like `55`, or empty = latest stable).

Upgrades are risky — work on a clean branch and go **one SDK version at a time** if the jump is more than one major.

## 0. Preconditions

```bash
git status --porcelain            # must be clean — otherwise stop and ask
node ~/.claude/skills/rn-conventions/scripts/detect-stack.js 2>/dev/null || node .claude/skills/rn-conventions/scripts/detect-stack.js
```

From the report note: `versions.expoSdk`, `versions.reactNative`, `workflow`, `newArchitecture`, `packageManager`, `isMonorepo`, `otaUpdates`.

- No `expo` dependency → this is bare RN: skip to **Bare React Native** below.
- Create a branch: `git checkout -b chore/expo-sdk-<target>`.

## 1. Research the target (don't skip)

Look up the official changelog / upgrade guide for **each** SDK between current and target (expo.dev blog "Expo SDK <n>" and the Expo changelog). Extract for this project only:
- Minimum versions now required: Node, Xcode, iOS deployment target, Android `compileSdk`/`minSdk`, JDK.
- Removed / renamed packages and APIs that this project imports (`Grep` for each).
- New Architecture changes (e.g. becoming mandatory) vs `newArchitecture` in the report.
- Changes to app config keys, `expo-router`, `expo-updates`, EAS.

Show the user a short summary of what will change **before** modifying files.

## 2. Upgrade

```bash
npx expo install expo@^<target>.0.0     # bumps expo itself
npx expo install --fix                   # aligns all Expo-managed deps to the SDK
npx expo-doctor                          # must end clean or with understood warnings
```

Then non-Expo libraries with native code (Reanimated, Gesture Handler, Skia, Sentry, Firebase, etc.): check each one's compatibility table for the new RN version and upgrade where required with `npx expo install <pkg>@<version>` (plain `npm install` / `yarn add` is blocked by a hook in Expo projects). Use the `dependency-auditor` agent if many are involved.

Monorepo: run from the app package; make sure only **one** copy of `react` / `react-native` resolves (`npm ls react-native`).

## 3. Migrate code and config

- Apply the breaking changes found in step 1 (renamed imports, removed APIs, config key changes).
- Update `app.json` / `app.config.*` per the guide (e.g. moved/removed keys, new plugin options).
- `expo-build-properties`: bump deployment target / SDK versions if the new SDK requires it.
- TypeScript: update `@types/react` to the version `expo install --fix` chose; fix new type errors.

## 4. Native folders

- **CNG** (`workflow` = managed): `npx expo prebuild --clean` (only if you build locally; native dirs stay gitignored).
- **Expo bare** (native dirs committed): native files must be updated by hand. Use the React Native Upgrade Helper diff for `<old RN> → <new RN>` and apply it to `ios/` and `android/`, then `cd ios && pod install --repo-update`.

## 5. Verify

```bash
<runCmd> tsc --noEmit
<lint script>
<test script> --ci
npx expo-doctor
npx expo export --platform all --output-dir /tmp/expo-export-check   # confirms JS bundles build
```

Local native builds (`npx expo run:ios` / `run:android`) if the toolchain is available; otherwise recommend an EAS development build. Use the `native-build-doctor` agent for any native build failure.

## 6. OTA updates warning

If `otaUpdates` is true: a new SDK means a new native runtime. Make sure `runtimeVersion` policy changes (e.g. `appVersion` / `fingerprint`) so old binaries **don't** receive JS built for the new SDK. Call this out to the user explicitly.

## Bare React Native

1. Open the React Native Upgrade Helper for `<current> → <target>` and list the changed files.
2. Bump `react-native`, `react`, and `@react-native/*` packages to the target versions.
3. Apply the native diff to `ios/` and `android/` file by file; preserve project customizations.
4. `cd ios && pod install --repo-update`; `cd android && ./gradlew clean`.
5. Upgrade native libraries per their compatibility tables. Verify as in step 5.

## Report

What was upgraded (from → to), breaking changes applied, deps changed, what was verified, what still needs a device test, and any manual follow-ups (store minimum OS change, OTA runtime bump).
