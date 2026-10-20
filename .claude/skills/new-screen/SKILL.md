---
name: new-screen
description: Creates a new screen in a React Native / Expo app following the project's navigation setup (Expo Router or React Navigation), file layout, styling, state, i18n and test conventions. Use when asked to add a screen, page or route. Arguments - screen name and optional purpose, e.g. /new-screen Settings "user preferences with theme toggle".
---

# New screen

Arguments: `$ARGUMENTS` — first word is the screen name, the rest (optional) is what the screen does.

## 1. Detect the stack

```bash
node ~/.claude/skills/rn-conventions/scripts/detect-stack.js 2>/dev/null || node .claude/skills/rn-conventions/scripts/detect-stack.js
```

Read `~/.claude/skills/rn-conventions/SKILL.md` (or `.claude/skills/…`) if you haven't in this session.

## 2. Learn local patterns

Open 2 existing screens (from `routerAppDir` or `layout.screensDir`) and one of their tests if any. Copy: file naming (`SettingsScreen.tsx` vs `settings.tsx` vs `index.tsx` in a folder), export style, how styles/theme are used, how data is fetched, how strings are translated, header configuration.

If the project has no screens yet, use the defaults below.

## 3. Create the screen — by navigation type

### Expo Router (`navigation` contains `expo-router`)
- Route file in `routerAppDir`, path from the requested URL: `settings.tsx`, `settings/index.tsx`, `(tabs)/settings.tsx`, or a dynamic `[id].tsx`. Ask only if the placement is genuinely ambiguous (e.g. inside tabs or a stack?).
- **Default export** the screen component (required by Expo Router).
- Keep the route file thin if the project does: route file imports a screen component from `src/features/…`/`src/screens/…`.
- Params: `useLocalSearchParams<{ id: string }>()`; validate/parse before use (they're always strings).
- Header/title: `<Stack.Screen options={{ title }} />` inside the component, or in the parent `_layout.tsx` — follow the project.
- If adding to tabs, update `(tabs)/_layout.tsx` with icon and label.
- Typed routes: if `experiments.typedRoutes` is on, use typed `href`s in links you add.

### React Navigation (`navigation` contains `react-navigation`)
- Create the component in `layout.screensDir` (or `src/screens/`).
- Register it in the right navigator (find with `Grep "create.*Navigator"`).
- Add the route and its params to the param-list type (`RootStackParamList` or similar) and use `NativeStackScreenProps<…, 'Settings'>` (or the project's helper type).
- If deep linking is configured (`linking` config), add the path.

### Neither / unknown
Ask which navigation the user wants before creating files.

## 4. Screen content defaults

- Safe areas handled the same way other screens do (SafeAreaView / insets / header handles it).
- Long or dynamic content → list component (`FlashList` if installed, else `FlatList`), never `ScrollView` + `.map()`.
- Loading, empty and error states if the screen loads data — using the project's server-state library (`serverState`) if any.
- Logic in a `useXxx` hook co-located with the screen when it's more than a few lines.
- Styling via the detected system and theme tokens.
- All user-facing text through the i18n function if `i18n.libraries` is non-empty; add keys to **every** locale file (see the `i18n` skill).
- Accessibility: header has an accessible title; interactive elements have `accessibilityRole`/labels.

## 5. Test

If `testing.unit` is set, add a test next to other screen tests: renders, primary interaction, one edge state. For Expo Router prefer `renderRouter` from `expo-router/testing-library` if available.

## 6. Verify and report

Run typecheck and the new test. Report: files created/changed, the route/path to open it, anything left as TODO (real data, icon, copy).
