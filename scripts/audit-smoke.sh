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

echo "=== static-tsc on renderer ==="
"$BUN" run "$REPO_ROOT/packages/audit/src/cli.ts" run renderer --probes=static-tsc --no-tickets --out="$OUT/static-tsc"

echo "=== static-bundle on webui ==="
"$BUN" run "$REPO_ROOT/packages/audit/src/cli.ts" run webui --probes=static-bundle --no-tickets --out="$OUT/static-bundle"

# Check both probes produced 0 findings
for d in "$OUT/static-tsc" "$OUT/static-bundle"; do
  count=$(python3 -c "import json,sys; print(json.load(open('$d/queue.json'))['findingCount'])" 2>/dev/null || jq '.findingCount' "$d/queue.json" 2>/dev/null || echo "error")
  if [ "$count" != "0" ]; then
    echo "FAIL: audit smoke found $count findings in $d"
    exit 1
  fi
done
echo "OK: audit smoke clean"
