---
name: store-listing
description: Writes and checks App Store and Google Play listing content for a mobile app - name, subtitle, keywords, short and full descriptions, what's new, localized versions, ASO keyword choices, and screenshot sizes (with a resize script). Use when working on store listings, ASO, app descriptions, release notes for the store, or store screenshots.
---

# Store listing (App Store + Google Play)

## 0. Gather facts — don't invent them

```bash
node ~/.claude/skills/rn-conventions/scripts/detect-stack.js 2>/dev/null || node .claude/skills/rn-conventions/scripts/detect-stack.js
```

Use `app.name`, `app.version`, bundle IDs, and `i18n.localesDir` (the app's supported languages are a good default for listing languages). Then read `README.md`, existing listing files if any (`fastlane/metadata/`, `store/`, `metadata/`, `docs/store*`), and the main screens to understand real features.

Ask the user only for what you can't find: target audience, top 3 competitors, main keywords they care about, tone, which locales.

**Never claim features the app doesn't have**, never use competitor brand names in keywords or text, never promise "free" if there are paid features without saying so.

## 1. Field limits

Limits change occasionally — if precision matters, confirm against Apple's and Google's current docs.

| Field | App Store | Google Play |
|---|---|---|
| App name / title | 30 | 30 |
| Subtitle | 30 | — |
| Short description | — | 80 |
| Keywords | 100 (comma-separated, no spaces needed) | — (indexed from title + descriptions) |
| Promotional text | 170 (editable without a new build) | — |
| Description | 4000 | 4000 |
| What's new | 4000 | 500 |

## 2. ASO rules

**App Store**
- Name + subtitle + keywords are indexed together — **don't repeat a word** across them; repetition wastes characters.
- Keywords field: singular forms are enough, no spaces after commas, no app name, no category name, no "app".
- Description is **not** indexed for search — write it for conversion (first 2–3 lines visible before "more").

**Google Play**
- Title, short description and full description are all indexed. Use the main keyword in the title and short description naturally, and 3–5 times across the full description — no keyword stuffing (policy violation).
- No emojis-only lines, no ALL CAPS, no "best/#1/top" claims without proof, no calls to rate the app (policy).

**Both**
- Lead with the core benefit, then 3–6 key features as short lines, then trust/privacy, then a closing line.
- Localize, don't translate literally: keywords must be what people in that locale actually search.

## 3. Output format

Produce one block per locale, ready to paste, with character counts:

```
### en-US
**App Store**
Name (24/30): …
Subtitle (28/30): …
Keywords (97/100): …
Promotional text (140/170): …
Description (1 850/4000):
…
What's new (…):
…

**Google Play**
Title (…/30): …
Short description (…/80): …
Full description (…/4000):
…
What's new (…/500): …
```

Count characters with code, not by eye:
```bash
node -e 'for (const s of process.argv.slice(1)) console.log([...s].length, s)' "Name here" "Subtitle here"
```

If the project uses fastlane (`fastlane/metadata`), offer to write each field to its file (`name.txt`, `subtitle.txt`, `keywords.txt`, `description.txt`, `release_notes.txt`, Android: `title.txt`, `short_description.txt`, `full_description.txt`, `changelogs/<versionCode>.txt`).

## 4. Screenshots

Required sizes (portrait). Verify current requirements before a submission.

| Store | Device | Size (px) |
|---|---|---|
| App Store | iPhone 6.9" | 1320 × 2868 (or 1290 × 2796) |
| App Store | iPhone 6.5" | 1284 × 2778 (or 1242 × 2688) |
| App Store | iPad 13" (if iPad supported) | 2064 × 2752 (or 2048 × 2732) |
| Google Play | Phone | 1080 × 1920 recommended (9:16; 320–3840 px per side) |
| Google Play | Feature graphic | 1024 × 500 |
| Google Play | Icon | 512 × 512 |

Resize/pad a folder of raw screenshots to a preset (uses `sips` on macOS or ImageMagick elsewhere):

```bash
bash ~/.claude/skills/store-listing/scripts/resize-screenshots.sh <input-dir> <output-dir> <preset> [pad-color]
# presets: ios-6.9  ios-6.5  ipad-13  android-phone  android-feature
```

Screenshot content tips: first 2–3 screenshots carry the conversion — one benefit per screenshot, short caption (≤ 5–6 words), consistent style, real UI, localized captions per locale.
