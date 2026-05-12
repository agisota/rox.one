#!/usr/bin/env bash
set -euo pipefail

# Usage: new-worklog.sh <ticket-id-and-slug>
# Example: new-worklog.sh T139-runtime-axe-probe
# Creates docs/worklog/<ticket-id-and-slug>.md from the AGENTS.md 11-section template.

if [ $# -lt 1 ]; then
  echo "Usage: $0 <ticket-id-and-slug>" >&2
  echo "Example: $0 T139-runtime-axe-probe" >&2
  exit 1
fi

SLUG="$1"
REPO_ROOT="$(git rev-parse --show-toplevel)"
TARGET="$REPO_ROOT/docs/worklog/$SLUG.md"

if [ -e "$TARGET" ]; then
  echo "Worklog already exists: $TARGET" >&2
  exit 1
fi

mkdir -p "$(dirname "$TARGET")"

cat > "$TARGET" <<EOF
# $SLUG — worklog

## 1. Task summary

## 2. Repo context discovered

## 3. Files inspected

## 4. Tests added first

## 5. Expected failing test output

## 6. Implementation changes

## 7. Validation commands run

## 8. Passing test output summary

## 9. Build output summary

## 10. Remaining risks

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---|---|
EOF

echo "Created: $TARGET"
