#!/usr/bin/env bash
#
# Package ONLY the files the extension needs into a distributable zip.
# Output: dist/awesome-preview-markdown-v<version>.zip (manifest.json at zip root)
#
# Excluded on purpose: samples/, docs/, scripts/, README*, CHANGELOG.md,
# TEST_CASES.md, .git/, .gitignore — none of these are needed to run the extension.
#
# LICENSE and NOTICE.md ARE included: Apache-2.0 (§4) requires shipping them with
# any redistribution, and the bundled vendor libraries require their attributions.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

command -v zip >/dev/null 2>&1 || { echo "error: 'zip' not found; install it first." >&2; exit 1; }
[ -f manifest.json ] || { echo "error: manifest.json not found in $ROOT" >&2; exit 1; }

# Read the version from manifest.json without requiring jq.
VERSION="$(sed -nE 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' manifest.json | head -n1)"
[ -n "$VERSION" ] || { echo "error: could not parse \"version\" from manifest.json" >&2; exit 1; }

NAME="awesome-preview-markdown"
OUT_DIR="dist"
OUT="$OUT_DIR/$NAME-v$VERSION.zip"

# Runtime files + license attribution.
INCLUDES=(
  manifest.json
  background.js
  viewer.html
  viewer.css
  viewer.js
  icons
  vendor
  LICENSE
  NOTICE.md
)

missing=0
for p in "${INCLUDES[@]}"; do
  [ -e "$p" ] || { echo "error: missing required path: $p" >&2; missing=1; }
done
[ "$missing" -eq 0 ] || exit 1

mkdir -p "$OUT_DIR"
rm -f "$OUT"

# -r recurse, -X strip extra file attributes, -x drop OS/editor cruft.
zip -r -X "$OUT" "${INCLUDES[@]}" -x '*.DS_Store' '*/.git/*' '.git/*' >/dev/null

echo "Packaged: $OUT"
echo "Version:  $VERSION"
echo "Size:     $(du -h "$OUT" | cut -f1)"
echo
echo "Contents:"
unzip -l "$OUT"
