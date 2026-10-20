---
name: release-prep
description: Prepares a React Native / Expo app release - pre-flight checks, version and build-number bump, changelog, EAS build and submit commands (or native archive steps for bare projects), and an OTA-update vs store-release decision. Use only when explicitly asked to prepare a release. Argument - patch | minor | major | explicit version, e.g. /release-prep minor.
disable-model-invocation: true
---

# Release prep

Bump: `$ARGUMENTS` (`patch` | `minor` | `major` | `X.Y.Z`; empty → ask).

This skill **prepares** the release. It never runs `eas build`, `eas submit`, `eas update` or pushes tags without the user confirming the exact command first.

## 0. Detect

```bash
git status --porcelain
node ~/.claude/skills/rn-conventions/scripts/detect-stack.js 2>/dev/null || node .claude/skills/rn-conventions/scripts/detect-stack.js
```

Note: `app.version`, `app.iosBuildNumber`, `app.androidVersionCode`, `appConfig`, `eas` (profiles, `appVersionSource`, `autoIncrement`), `otaUpdates`, `app.runtimeVersion`, `workflow`.

Working tree must be clean; if not, list the changes and stop.

## 1. Store release or OTA update?

If `otaUpdates` is true, decide first:
- Only JS/asset changes since the last store build, **and** no new native dependencies, no app-config changes that affect native code, same Expo SDK → an **OTA update** (`eas update`) is enough. Skip to step 6.
- Otherwise → full store release.

Check with `git diff <last-release-tag>..HEAD -- package.json app.json app.config.* ios android` and, if available, `npx expo-updates fingerprint:generate` / compare runtime fingerprints.

## 2. Pre-flight checks

Run what exists and stop on failures:
- typecheck (`tsc --noEmit`), lint, unit tests (`--ci`)
- `npx expo-doctor` (Expo projects)
- `Grep` for leftovers in app code: `console.log`, `debugger`, `TODO(release)`, `.only(` in tests, localhost / staging URLs, test API keys
- Environment: production env vars/secrets configured for the production EAS profile (`eas env:list --environment production` or `eas secret:list`); no `.env` with secrets committed — check with `git ls-files | grep -E '(^|/)\.env'` (don't open `.env` files: they're protected by a hook)
- `app.config` sanity: correct bundle ID / package, icon and splash present, permissions strings (iOS `infoPlist` usage descriptions) for every permission the app requests

## 3. Version bump

New marketing version = bump of `app.version` per `$ARGUMENTS`.

Where to write it depends on the setup:
- `eas.appVersionSource` = `remote` → only the marketing `version` lives in app config; **build numbers are managed by EAS** (don't touch `buildNumber`/`versionCode`). With `autoIncrement` on the profile, EAS bumps them.
- `local` (default) → bump `version`, increment `ios.buildNumber` and `android.versionCode` in `app.json` (or tell the user which line to change in a dynamic `app.config.*`).
- Bare projects without Expo config → `ios/<App>/Info.plist` (`CFBundleShortVersionString`, `CFBundleVersion`) or Xcode build settings (`MARKETING_VERSION`, `CURRENT_PROJECT_VERSION`), and `android/app/build.gradle` (`versionName`, `versionCode`).
- Keep `package.json` `version` in sync if the project does.
- `runtimeVersion`: if the policy is manual (a fixed string), bump it for a native release so old binaries don't receive incompatible OTA updates.

## 4. Changelog

From `git log <last-tag>..HEAD --oneline` (last tag: `git describe --tags --abbrev=0`), write:
- an entry in `CHANGELOG.md` (if the project keeps one), grouped: Added / Changed / Fixed;
- a user-facing **"What's new"** text (short, no internal jargon, ≤ 4000 chars, in the store's language(s)) — offer to hand off to the `store-listing` skill for localized versions.

## 5. Build & submit commands (show, don't run)

If the user asks you to run them, a hook shows a confirmation prompt for each `eas build` / `eas submit` / `eas update` / `git push` — that's the intended checkpoint, not an error.

EAS (if `eas.present`):
```bash
eas build --platform all --profile production
eas submit --platform ios --profile production --latest
eas submit --platform android --profile production --latest
```
Use the actual profile names from the report. If there's no submit profile, explain what `eas submit` will ask for.

Bare without EAS: Xcode → Product → Archive → Distribute; Android → `cd android && ./gradlew bundleRelease` → upload the `.aab` in Play Console.

Commit and tag (after user confirms):
```bash
git commit -am "chore(release): vX.Y.Z"
git tag vX.Y.Z
```

## 6. OTA update path

```bash
eas update --channel production --message "vX.Y.Z: <summary>"
```
Confirm the channel matches the production build profile's `channel` in `eas.json`. Consider a staged rollout (`--rollout-percentage`) if the project uses it.

## 7. Final checklist for the user

- [ ] Store screenshots/text still accurate (new features?)
- [ ] iOS: export compliance / encryption answer, privacy "nutrition label" changes if new data collection
- [ ] Android: Data safety form if new data collection; target SDK meets current Play requirement
- [ ] Monitoring (Sentry etc.): release created, source maps uploaded
- [ ] Phased rollout setting chosen

## Report

Release type (store/OTA), old → new version, files changed, checks run and their result, the exact commands to run next.
