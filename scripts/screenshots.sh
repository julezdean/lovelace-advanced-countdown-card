#!/usr/bin/env bash
# Regenerates docs/images/ from demo/shot.html.
#
# The stage renders the cards of one scene at a fixed card width on a frozen
# clock, so the viewport screenshot IS the image. Sizes live in SHOTS below
# and in docs/screenshots.md -- they are not constants; re-measure after a
# layout change (the recipe is in docs/screenshots.md).
#
# Requires: Google Chrome, python3, and a build (npm run build).
set -euo pipefail

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT="${PORT:-4174}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/docs/images"

[ -x "$CHROME" ] || { echo "Chrome not found at $CHROME" >&2; exit 1; }
[ -f "$ROOT/dist/advanced-countdown-card.js" ] || { echo "Run 'npm run build' first." >&2; exit 1; }

# name|viewport (measured body size)|query
SHOTS=(
  "hero-light|1044,308|scene=hero&w=240"
  "hero-dark|1044,308|scene=hero&w=240&dark=1"
  "renderers|964,495|scene=renderers&w=220&cols=4"
  "timer-states|964,296|scene=timer_states&w=220"
  "layouts|408,377|scene=layouts&w=360&cols=1"
  "colors|792,273|scene=colors&w=240"
  "compact|792,229|scene=compact&w=240"
  "errors|852,134|scene=errors&w=260"
  "template|308,319|scene=template&w=260"
)

mkdir -p "$OUT"
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT" >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT

# Wait for the server rather than sleeping a guessed amount.
for _ in $(seq 1 50); do
  curl -sf "http://127.0.0.1:$PORT/demo/shot.html" >/dev/null && break
  sleep 0.1
done

for shot in "${SHOTS[@]}"; do
  IFS='|' read -r name size query <<<"$shot"
  "$CHROME" \
    --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
    --virtual-time-budget=3000 \
    --window-size="$size" \
    --screenshot="$OUT/$name.png" \
    "http://127.0.0.1:$PORT/demo/shot.html?$query" >/dev/null 2>&1
  echo "  $name.png  ($size)"
done

echo "Done: $OUT"
