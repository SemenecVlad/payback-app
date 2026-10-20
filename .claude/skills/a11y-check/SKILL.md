---
name: a11y-check
description: Audits and fixes accessibility in React Native / Expo screens and components - screen reader labels and roles, states, touch target sizes, color contrast, font scaling, focus order, reduced motion, and VoiceOver/TalkBack behavior. Use when asked about accessibility, a11y, screen readers, VoiceOver, TalkBack, or before a release.
---

# Accessibility check

Scope: files/screens named in the request, otherwise the screens changed on the current branch, otherwise the whole app starting from the most used screens.

## 0. Detect

```bash
node ~/.claude/skills/rn-conventions/scripts/detect-stack.js 2>/dev/null || node .claude/skills/rn-conventions/scripts/detect-stack.js
```

`styling` tells you where colors/sizes come from (theme tokens → check contrast there once instead of per component). Check if a UI kit (Paper, Tamagui, gluestack) already provides accessible primitives — fix at the shared component level when possible.

## 1. Checklist

**Screen reader (VoiceOver / TalkBack)**
- Every touchable (`Pressable`, `TouchableOpacity`, custom buttons) has `accessibilityRole` (`button`, `link`, `checkbox`, `switch`, `tab`, `header`, `image`, `adjustable`, …).
- Icon-only buttons have `accessibilityLabel` (describe the action: "Delete photo", not "trash icon").
- `accessibilityHint` only when the result isn't obvious from the label.
- State is exposed: `accessibilityState={{ disabled, selected, checked, busy, expanded }}`; sliders/steppers use `accessibilityValue` and `accessibilityActions`.
- Decorative images: `accessible={false}` / `importantForAccessibility="no"`; meaningful images have a label.
- Grouping: a card that acts as one control is a single focusable element (`accessible` on the container, combined label), not 5 separate focus stops.
- Headings: screen titles and section titles have `accessibilityRole="header"`.
- Custom modals/sheets: `accessibilityViewIsModal` (iOS) and focus moved into them on open; `onAccessibilityEscape` closes them.
- Dynamic changes (errors, toasts, loaded results) announced with `AccessibilityInfo.announceForAccessibility` or a live region (`accessibilityLiveRegion` on Android).
- Form inputs: visible label connected (`accessibilityLabel` or `accessibilityLabelledBy` on Android), errors read out.

**Touch targets**
- At least 44×44 pt (iOS) / 48×48 dp (Android). Small icons → `hitSlop` or padding.
- Enough spacing between adjacent targets.

**Text & scaling**
- No `allowFontScaling={false}` on body text; `maxFontSizeMultiplier` only to protect layouts that truly break, ≥ 1.5.
- Layout survives the largest font size: no fixed heights on text containers, text can wrap, nothing gets clipped.
- Don't convey meaning with color alone (errors need an icon or text too).

**Contrast** (WCAG 2.2 AA)
- Normal text ≥ 4.5:1, large text (≥ 18pt or 14pt bold) and UI component boundaries/icons ≥ 3:1. Check placeholder text, disabled states that still need to be readable, text on images.
- Check both light and dark themes.
- Compute instead of guessing:
  ```bash
  node -e 'const L=h=>{const c=h.replace("#","").match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4);return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]};const[a,b]=process.argv.slice(1).map(L);console.log(((Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)).toFixed(2)+":1")' "#767676" "#FFFFFF"
  ```

**Motion**
- Respect reduced motion: `AccessibilityInfo.isReduceMotionEnabled()` / Reanimated `useReducedMotion()` — shorten or skip non-essential animations, no auto-playing parallax.

**Focus & navigation order**
- Reading order matches visual order (absolute positioning can scramble it).
- After navigation, focus lands on the screen title or first meaningful element.

## 2. Fix

Fix issues directly when the fix is unambiguous (adding roles, labels, states, hitSlop). Labels must be translated if the project uses i18n (see the `i18n` skill). Ask before changing brand colors to meet contrast — propose the nearest passing color instead.

## 3. Manual test plan

Static review can't catch everything. End with a short plan for the user:
- iOS: Settings → Accessibility → VoiceOver (or Accessibility Inspector in Xcode on the simulator); Larger Text to max.
- Android: TalkBack; Display size and Font size to max; Accessibility Scanner app.
- Swipe through each audited screen once and complete the main task with eyes closed.

## Report

Table: `file:line` | issue | severity (blocker / major / minor) | fixed? — then the manual test plan.
