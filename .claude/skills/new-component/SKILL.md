---
name: new-component
description: Creates a reusable React Native component following the project's file layout, styling system, theme tokens, typing, accessibility, test and Storybook conventions. Use when asked to add or extract a component. Arguments - component name and optional description, e.g. /new-component PrimaryButton "full-width button with loading state".
---

# New component

Arguments: `$ARGUMENTS` — first word is the component name (PascalCase), the rest is what it does.

## 1. Detect the stack

```bash
node ~/.claude/skills/rn-conventions/scripts/detect-stack.js 2>/dev/null || node .claude/skills/rn-conventions/scripts/detect-stack.js
```

## 2. Check before creating

- **Does it already exist?** `Grep` for similar names and for the UI kit in `styling` (Paper, Tamagui, gluestack…) — reuse or extend instead of duplicating.
- Open 2 existing components in `layout.componentsDir`. Copy their structure: single file vs folder (`Button/index.ts`, `Button.tsx`, `Button.styles.ts`, `Button.test.tsx`, `Button.stories.tsx`), export style, props typing, how variants are done.

## 3. Write the component

**API**
- `type <Name>Props` exported; extend the underlying RN props where it makes sense (`PressableProps`, `TextInputProps`, `ViewProps`) and spread the rest so callers keep `style`, `testID`, accessibility props.
- Variants as a string-union prop (`variant: 'primary' | 'secondary'`), not booleans per variant.
- Controlled inputs: `value` + `onChange…`; no hidden internal state the parent can't control.
- Forward refs for inputs and anything focusable (`forwardRef`, or `ref` as a prop on React 19).

**Styling** — by detected system:
- `StyleSheet (default)` → `StyleSheet.create` at module level, values from theme tokens.
- `nativewind` / `twrnc` → `className` / `tw`; merge external `className`.
- `tamagui` / `restyle` / `unistyles` / `styled-components` → use the project's `styled()`/theme primitives.
- No raw hex colors or magic spacing numbers if a theme exists.

**Behavior**
- Pressables: visible pressed state, `hitSlop` or min 44×44pt touch target, `disabled` styling and `accessibilityState`.
- Loading state disables interaction.
- No data fetching or global state inside a reusable UI component — pass data via props.
- `React.memo` only if it will be rendered in lists or receives stable props from a frequently re-rendering parent.

**Accessibility**
- `accessibilityRole`, `accessibilityLabel` (default from visible text), `accessibilityHint` when the action isn't obvious, `accessibilityState` for disabled/selected/checked/busy.
- Text scales with system font size (don't set `allowFontScaling={false}` without reason).

**Strings**: no hardcoded user-facing text inside a reusable component — accept it via props (or translation keys if that's the project pattern).

## 4. Test and story

- If `testing.rntl` → test rendering, press/change callbacks, disabled and loading states. Query by role/label.
- If `storybook` → add a story with each variant and state.

## 5. Verify and report

Typecheck + run the new test. Report the files created and a 3–5 line usage example.
