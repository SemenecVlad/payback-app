---
name: i18n
description: Handles localization in a React Native / Expo app - extracting hardcoded strings into translation files, adding a new language, checking for missing, empty or unused keys, plurals and interpolation, and setting up i18n if the project has none. Use when working with translations, locales, languages or hardcoded UI text.
---

# i18n

## 0. Detect

```bash
node ~/.claude/skills/rn-conventions/scripts/detect-stack.js 2>/dev/null || node .claude/skills/rn-conventions/scripts/detect-stack.js
```

Use `i18n.libraries` and `i18n.localesDir`. If `localesDir` is null but a library is installed, find the files: `Grep` for `i18n.init`, `createInstance`, `new I18n(`, `resources:`.

Learn the project's patterns from 2–3 files that already use translations: hook (`useTranslation()`), namespaces, key naming (`settings.title` vs `settingsTitle` vs `Settings.Title`), where locale files live, TS typing of keys (`i18next.d.ts` / `CustomTypeOptions`).

## 1. Check translations

```bash
node ~/.claude/skills/i18n/scripts/check-locales.js <localesDir> [--base en] [--src src] [--fn t]
# or: node .claude/skills/i18n/scripts/check-locales.js …
```

Reports per locale: missing, empty, extra, identical-to-base (probably untranslated), keys used in code but missing in base, and possibly unused keys. Works for JSON files (`en.json`, or `en/common.json` namespaces). For non-JSON formats (TS/JS objects, `.po`, `.arb`), read the files directly and do the same comparison.

Dynamic keys (`` t(`status.${s}`) ``) can't be detected statically — check those by hand before deleting "unused" keys.

## 2. Extract hardcoded strings

Find candidates:
```bash
# JSX text children and common text props
rg -n --type-add 'rn:*.{tsx,jsx}' -t rn '>\s*[A-Z][^<>{}]{2,}<|(title|placeholder|label|accessibilityLabel|accessibilityHint|message|text)=["'"'"'][A-Za-z][^"'"'"']+' src app
# Alert.alert / toasts with literal strings
rg -n "Alert\.alert\(\s*['\"]|toast\.\w+\(\s*['\"]" src app
```

For each user-facing string:
- Create a key following the project's naming scheme, grouped by screen/feature.
- Replace with the translation call; keep interpolation as variables (`t('cart.total', { amount })`), never string concatenation — word order differs between languages.
- Counts → plurals (i18next: `key_one`, `key_other`, and `_few`/`_many` for languages that need them, e.g. Ukrainian, Polish, Russian, Arabic).
- Formatting dates/numbers/currency → `Intl` / the library's formatters with the current locale, not manual formatting.
- Add the key to **every** locale. For languages you can't translate reliably, put the base-language text and list them in the report as "needs translation" — don't leave keys missing.
- Not translatable: log messages, analytics event names, testIDs, API values.

Run the checker again at the end.

## 3. Add a new language

1. Copy the base locale file(s) to the new locale code (BCP-47: `uk`, `pt-BR`, `zh-Hans`).
2. Translate (or mark as needing translation, see above). Mind plural categories of that language.
3. Register it in the i18n init (`resources`, `supportedLngs`, language picker list).
4. RTL languages (`ar`, `he`, `fa`, `ur`): `I18nManager.forceRTL` / `allowRTL` handling, use `start`/`end` instead of `left`/`right` in styles, mirror directional icons; changing direction requires an app reload.
5. Expo: to localize the app name and iOS permission prompts, add a file per language to `expo.locales` in app config. On iOS, also make sure the OS knows the app supports the language (the `locales` entry handles this in Expo; in bare projects add the language in Xcode → Project → Localizations).

## 4. No i18n yet → setup (only if asked)

Recommended default for Expo: `i18next` + `react-i18next` + `expo-localization`; for bare RN: `i18next` + `react-i18next` + `react-native-localize`.

```bash
npx expo install expo-localization i18next react-i18next   # Expo (plain `<pm> add` is blocked by a hook here)
<pm> add i18next react-i18next react-native-localize       # bare React Native
```

Create `src/i18n/index.ts` (init with resources, `lng` from the device locale with fallback to `en`, `interpolation: { escapeValue: false }`), `src/i18n/locales/en.json`, import it once in the root layout / `App.tsx`, and add TS key typing if the project uses TypeScript. Then extract strings (step 2).

## Report

Keys added/changed per locale, files touched, checker result, list of strings that still need a human translator.
