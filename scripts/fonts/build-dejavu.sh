#!/usr/bin/env bash
# Builds the self-hosted DejaVu Sans subsets (woff2) used by src/app/layout.js.
# Usage: scripts/fonts/build-dejavu.sh <DejaVuSans-Bold.ttf> <DejaVuSans-Regular.ttf> <output dir>
# Both TTF files must have the same version (2.35 or 2.37), otherwise the script refuses.
# Sources: Bold from the brand kit (design-rebrand/logo-final/_src/fonts), Regular from the
# matplotlib wheel (matplotlib/mpl-data/fonts/ttf/DejaVuSans.ttf, version 2.35).
set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "Usage: $0 <bold.ttf> <regular.ttf> <output dir>" >&2
  exit 2
fi

BOLD="$1"
REGULAR="$2"
OUT="$3"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VENV="$ROOT/.agents/tasks/RD-BRAND-01/tools/venv"

if [ ! -x "$VENV/bin/pyftsubset" ]; then
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install --quiet fonttools brotli
fi

version_of() {
  "$VENV/bin/python" - "$1" <<'PY'
import sys
from fontTools.ttLib import TTFont
print(TTFont(sys.argv[1])["name"].getDebugName(5))
PY
}

VB="$(version_of "$BOLD")"
VR="$(version_of "$REGULAR")"
if [ "$VB" != "$VR" ]; then
  echo "Version mismatch: Bold is '$VB', Regular is '$VR'" >&2
  exit 1
fi
case "$VB" in
  "Version 2.35"|"Version 2.37") ;;
  *) echo "Unsupported version: '$VB' (expected 2.35 or 2.37)" >&2; exit 1 ;;
esac

UNICODES="U+0000-024F,U+0250-02AF,U+02B0-02FF,U+0300-036F,U+1E00-1EFF,U+2000-206F,U+20AC,U+2122,U+2190-21FF,U+2212,U+2713,U+2715,U+FEFF,U+FFFD"

mkdir -p "$OUT"
for pair in "Regular:$REGULAR" "Bold:$BOLD"; do
  name="${pair%%:*}"
  src="${pair#*:}"
  "$VENV/bin/pyftsubset" "$src" \
    --flavor=woff2 \
    --layout-features='*' \
    --name-IDs=0,1,2,3,4,5,6,13,14 \
    --unicodes="$UNICODES" \
    --output-file="$OUT/DejaVuSans-$name.woff2"
done
