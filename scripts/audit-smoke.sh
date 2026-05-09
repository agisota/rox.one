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
exec "$BUN" run "$REPO_ROOT/packages/audit/src/cli.ts" run renderer --probes=static-tsc --out="$REPO_ROOT/audits/_smoke"
