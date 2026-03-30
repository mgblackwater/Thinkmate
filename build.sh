#!/bin/bash
# build.sh — builds Thinkmate for Chrome and Firefox
set -e

SHARED_FILES=(
  apply.js background.js content.js options.js options.html panel.css rules.json
  core/ coaches/ icons/ _metadata/
)

mkdir -p dist

for browser in chrome firefox; do
  echo "Building $browser..."
  tmp=$(mktemp -d)

  # Copy shared files
  for f in "${SHARED_FILES[@]}"; do
    cp -r "$f" "$tmp/"
  done

  # Copy browser-specific manifest
  cp "manifest.$browser.json" "$tmp/manifest.json"

  # Create zip
  (cd "$tmp" && zip -r - .) > "dist/thinkmate-$browser.zip"
  rm -rf "$tmp"

  echo "  → dist/thinkmate-$browser.zip"
done

echo "Done!"
