#!/usr/bin/env bash
# Resize + pad screenshots to store sizes, preserving aspect ratio.
# Usage: resize-screenshots.sh <input-dir> <output-dir> <preset> [pad-color-hex]
# Presets: ios-6.9 ios-6.5 ipad-13 android-phone android-feature
# Requires: sips (macOS, built in) or ImageMagick (magick / convert).
set -euo pipefail

if [ $# -lt 3 ]; then
  echo "Usage: $0 <input-dir> <output-dir> <preset> [pad-color-hex, default FFFFFF]" >&2
  echo "Presets: ios-6.9 ios-6.5 ipad-13 android-phone android-feature" >&2
  exit 1
fi

IN="$1"; OUT="$2"; PRESET="$3"; PAD="${4:-FFFFFF}"; PAD="${PAD#\#}"

case "$PRESET" in
  ios-6.9)         W=1320; H=2868 ;;
  ios-6.5)         W=1284; H=2778 ;;
  ipad-13)         W=2064; H=2752 ;;
  android-phone)   W=1080; H=1920 ;;
  android-feature) W=1024; H=500  ;;
  *) echo "Unknown preset: $PRESET" >&2; exit 1 ;;
esac

[ -d "$IN" ] || { echo "Input dir not found: $IN" >&2; exit 1; }
mkdir -p "$OUT"

if command -v magick >/dev/null 2>&1; then IM="magick"
elif command -v convert >/dev/null 2>&1; then IM="convert"
else IM=""; fi

if [ -z "$IM" ] && ! command -v sips >/dev/null 2>&1; then
  echo "Need ImageMagick (brew install imagemagick / apt install imagemagick) or macOS sips." >&2
  exit 1
fi

count=0
shopt -s nullglob nocaseglob
for f in "$IN"/*.png "$IN"/*.jpg "$IN"/*.jpeg "$IN"/*.webp; do
  name="$(basename "${f%.*}").png"
  dest="$OUT/$name"
  if [ -n "$IM" ]; then
    "$IM" "$f" -resize "${W}x${H}" -background "#$PAD" -gravity center -extent "${W}x${H}" -strip "PNG24:$dest"
  else
    sips -s format png "$f" --out "$dest" >/dev/null
    cw=$(sips -g pixelWidth "$dest" | awk '/pixelWidth/{print $2}')
    ch=$(sips -g pixelHeight "$dest" | awk '/pixelHeight/{print $2}')
    # Fit inside W x H keeping aspect ratio, then pad to the exact size.
    if [ $(( cw * H )) -gt $(( ch * W )) ]; then
      sips --resampleWidth "$W" "$dest" >/dev/null
    else
      sips --resampleHeight "$H" "$dest" >/dev/null
    fi
    sips --padToHeightWidth "$H" "$W" --padColor "$PAD" "$dest" >/dev/null
  fi
  count=$((count + 1))
  echo "✔ $dest"
done

echo "Done: $count file(s) → $OUT (${W}x${H}, preset $PRESET)"
[ "$count" -gt 0 ] || echo "No .png/.jpg/.jpeg/.webp files found in $IN" >&2
