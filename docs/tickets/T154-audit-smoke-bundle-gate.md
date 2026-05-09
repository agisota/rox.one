# T154 - Extend audit-smoke.sh with static-bundle gate

Status: done

## Context

Sub-project D. After `budget.json` files exist (T153), the CI smoke script must enforce the bundle budget on every run. Previously `scripts/audit-smoke.sh` only ran `static-tsc` against renderer. This ticket extends it to also run `static-bundle` against webui and fail the script (exit non-zero) if any findings are emitted.

## Goal

Modify `scripts/audit-smoke.sh` to:
1. Run `static-tsc` on renderer (unchanged).
2. Run `static-bundle` on webui.
3. Check both output `queue.json` files for `findingCount: 0`; exit 1 with a descriptive message if any finding is found.

Verify:
- Normal run exits 0.
- Halving the webui budget causes the script to exit 1 (regression-gate proof).

## Required UI

None.

## Required Data/API

None — probe reads `budget.json` from `apps/webui/`.

## Required Automations

`validate:audit` in root `package.json` already maps to `bash scripts/audit-smoke.sh`, so extending the script automatically extends the CI gate.

## Required Subagents

None.

## TDD Requirements

Manual regression test: temporarily halve `apps/webui/budget.json` values, run the script, assert exit 1, then restore the original budget.

## Implementation Requirements

Replace `exec` call (which prevents any post-check logic) with two sequential probe runs, then a loop that checks `findingCount` in each output directory.

Use `python3 -c` for JSON parsing as a portable fallback (avoids `jq` dependency requirement).

## Validation Commands

```bash
bash scripts/audit-smoke.sh          # expect exit 0, "OK: audit smoke clean"
# regression test (halve budget, expect exit 1, restore)
cp apps/webui/budget.json /tmp/budget.bak
python3 -c "import json; d=json.load(open('apps/webui/budget.json')); json.dump({k:v//2 for k,v in d.items()}, open('apps/webui/budget.json','w'))"
bash scripts/audit-smoke.sh && echo BAD || echo "OK: failed as expected"
cp /tmp/budget.bak apps/webui/budget.json
```

## Acceptance Criteria

- [x] `bash scripts/audit-smoke.sh` exits 0 with original budgets
- [x] Script runs both `static-tsc` (renderer) and `static-bundle` (webui) gates
- [x] Script exits 1 with halved budget (regression gate proven)
- [x] Budget restored after regression test
- [x] Worklog complete
- [x] Commit created

## Worklog

`docs/worklog/T154-audit-smoke-bundle-gate.md`
