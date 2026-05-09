#!/usr/bin/env bash
set -euo pipefail

# Resolve bun: prefer PATH, fall back to ~/.bun/bin/bun
if command -v bun >/dev/null 2>&1; then
  BUN=bun
elif [ -x "$HOME/.bun/bin/bun" ]; then
  BUN="$HOME/.bun/bin/bun"
else
  echo "error: bun not found on PATH or in \$HOME/.bun/bin/bun" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$REPO_ROOT/audits/_smoke"
rm -rf "$OUT"

# Parse flags
SKIP_BUILD=0
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=1 ;;
  esac
done

echo "=== static-tsc on renderer ==="
"$BUN" run "$REPO_ROOT/packages/audit/src/cli.ts" run renderer --probes=static-tsc --no-tickets --out="$OUT/static-tsc"

if [ "$SKIP_BUILD" -eq 0 ]; then
  echo "=== building webui ==="
  (cd "$REPO_ROOT" && "$BUN" run webui:build) 2>&1 | tail -3
fi

echo "=== static-bundle on webui ==="
"$BUN" run "$REPO_ROOT/packages/audit/src/cli.ts" run webui --probes=static-bundle --no-tickets --out="$OUT/static-bundle-webui"

# Aggregate finding counts
total_findings=0

tsc_count=$(python3 -c "import json,sys; print(json.load(open('$OUT/static-tsc/queue.json'))['findingCount'])" 2>/dev/null \
  || jq '.findingCount' "$OUT/static-tsc/queue.json" 2>/dev/null \
  || echo "error")
if [ "$tsc_count" = "error" ]; then
  echo "FAIL: could not read finding count from $OUT/static-tsc/queue.json" >&2
  exit 1
fi
total_findings=$((total_findings + tsc_count))

webui_count=$(python3 -c "import json,sys; print(json.load(open('$OUT/static-bundle-webui/queue.json'))['findingCount'])" 2>/dev/null \
  || jq '.findingCount' "$OUT/static-bundle-webui/queue.json" 2>/dev/null \
  || echo "error")
if [ "$webui_count" = "error" ]; then
  echo "FAIL: could not read finding count from $OUT/static-bundle-webui/queue.json" >&2
  exit 1
fi
total_findings=$((total_findings + webui_count))

if [ "$total_findings" -ne 0 ]; then
  echo "FAIL: audit smoke found $total_findings total findings"
  exit 1
fi
echo "OK: audit smoke clean"
