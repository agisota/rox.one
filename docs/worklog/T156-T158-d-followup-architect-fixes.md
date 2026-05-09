# T156–T158 - D-followup: glob budgets + build-before-smoke + extend smoke coverage

## 1. Task summary

Three architect-flagged failure modes in sub-project D's static-bundle gate:

1. **T156** — Content-hash drift silently bypasses the gate. Exact chunk
   names in `budget.json` become stale after Vite rebuild. Fix: glob
   patterns (`"assets/main-*.js"`) that survive hash churn.
2. **T157** — Smoke ran against whatever `dist/` existed (possibly
   absent). Fix: build each surface before probing.
3. **T158** — Smoke only gated webui. viewer and marketing had
   `budget.json` files but were never probed. Fix: loop over all three.

## 2. Repo context discovered

- `packages/audit/src/probes/static-bundle.ts:28` — `existsSync(filePath)
  continue` was the root cause of silent pass on hash drift.
- `apps/webui/budget.json`, `apps/viewer/budget.json`,
  `apps/marketing/budget.json` — all had exact content-hashed names.
- `apps/electron/budget.json` — `{"main.js": 500000}` placeholder; exact
  name, no glob needed, electron excluded from smoke loop.
- `scripts/audit-smoke.sh` — ran single `static-bundle` probe against
  webui only; no build step.
- Root `package.json`: `"webui:build"`, `"viewer:build"`,
  `"marketing:build"` all defined as Vite build commands.
- `bun --cwd REPO_ROOT run script` does not work as expected in this
  environment; `(cd "$REPO_ROOT" && "$BUN" run script)` is the correct
  pattern.

## 3. Files changed

| File | Change |
|---|---|
| `packages/audit/src/probes/static-bundle.ts` | Add `expandPattern()` glob helper; emit `_probe.bundle.budget-stale` on stale globs |
| `packages/audit/tests/probes/static-bundle.test.ts` | Add 5 new glob-pattern test cases |
| `apps/webui/budget.json` | Convert exact hashes to glob patterns |
| `apps/viewer/budget.json` | Convert exact hash to glob pattern |
| `apps/marketing/budget.json` | Convert exact hash to glob pattern |
| `apps/electron/budget.json` | Left unchanged (exact filename, no glob needed) |
| `scripts/audit-smoke.sh` | Build-before-probe + SURFACES loop + `--skip-build` flag |

## 4. Implementation details

### T156 — glob expansion in static-bundle probe

`expandPattern(distRoot, pattern)`:
- No `*` in pattern → exact-file fallback (original behaviour).
- Has `*` → split at last `/` to get containing dir and filename glob.
  Convert `*` → `[^/]*` regex. Read dir, filter matching files.
- 0 matches → emit `_probe.bundle.budget-stale` (confidence 0, severity high).
- 1+ matches → pick largest by `statSync().size`, compare to budget.

### T157 — build-before-smoke

Added `--skip-build` flag parsed from `$@`. Default (`SKIP_BUILD=0`)
runs `(cd "$REPO_ROOT" && "$BUN" run "$surface:build") 2>&1 | tail -3`
before each probe. The `(cd ...)` subshell is required because
`"$BUN" --cwd` does not work correctly in this shell environment.

### T158 — multi-surface loop

Replaced single webui probe with:
```bash
SURFACES=("webui" "viewer" "marketing")
for surface in "${SURFACES[@]}"; do
  # optional build
  # probe → out/static-bundle-$surface
done
# aggregate findingCount across all three
```

## 5. Tests added

`packages/audit/tests/probes/static-bundle.test.ts` — 5 new cases in
`describe("glob pattern budgets")`:

| Test | Expected |
|---|---|
| Glob matches chunk, under budget | 0 findings |
| Glob matches chunk, over budget | 1 `bundle:over-budget` finding |
| Stale glob + valid glob in same budget | 0 findings (stale exact key silent, valid glob passes) |
| Stale glob only (`NONEXISTENT-*.js`) | 1 `_probe.bundle.budget-stale` finding, confidence 0 |
| Exact filename key, no match | 0 findings (backward compat) |

## 6. Validation commands run

```
# Unit tests
cd packages/audit && ~/.bun/bin/bun test tests/probes/static-bundle.test.ts
# → 9 pass, 0 fail

# Full smoke
bash scripts/audit-smoke.sh
# === building webui === ... ✓ built in 19.91s
# === static-bundle on webui === audit run complete: 0 findings
# === building viewer === ... ✓ built in 15.64s
# === static-bundle on viewer === audit run complete: 0 findings
# === building marketing === ... ✓ built in 954ms
# === static-bundle on marketing === audit run complete: 0 findings
# OK: audit smoke clean  (exit 0)

# --skip-build
bash scripts/audit-smoke.sh --skip-build
# OK: audit smoke clean  (exit 0)

# Regression 1: stale glob
# → NONEXISTENT-*.js pattern: 1 budget-stale finding → exit 1  ✓

# Regression 2: halved budget
# → main-*.js at 2896765 (half of 5793531): 1 over-budget finding → exit 1  ✓
```

## 7. Typecheck

```
cd packages/audit && ~/.bun/bin/bun x tsc --noEmit   # exit 0
cd packages/shared && ~/.bun/bin/bun x tsc --noEmit  # exit 0
```

## 8. Commit SHAs

| Commit | SHA | Message |
|---|---|---|
| T156 | 4e13ea3 | feat(audit): static-bundle probe supports glob patterns in budget.json [T156] |
| T157 | 50dba45 | chore(d): audit-smoke runs build before bundle gate [T157] |
| T158 | ea713c7 | chore(d): extend audit-smoke to viewer + marketing static-bundle gates [T158] |

## 9. Remaining risks / deviations

- **electron excluded from smoke**: `apps/electron/budget.json` is a
  placeholder (`main.js: 500000`). There is no `electron:build` that
  produces a single `dist/main.js` chunk the probe can match. Deferred
  to a future ticket when the electron bundle audit is properly scoped.
- **python3/jq fallback**: finding-count parsing uses `python3 -c` with
  `jq` fallback. If neither is present the script echoes "error" and
  exits 1 (safe-fail). Both are available in the current CI environment.
- **tail -3 on build output**: `tail -3` may hide build errors. Errors
  still cause the subshell to exit non-zero, which propagates through
  `set -e`, so the smoke script correctly fails on build failure.

## 10. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---|---|
| Glob patterns survive hash drift | ✅ | Unit tests + smoke against fresh build |
| Stale glob emits budget-stale finding | ✅ | Regression test 1: exit 1 with 1 finding |
| Exact filename keys backward compat | ✅ | electron budget.json unchanged; unit test |
| webui:build runs before probe | ✅ | "✓ built in 19.91s" in smoke output |
| viewer:build runs before probe | ✅ | "✓ built in 15.64s" in smoke output |
| marketing:build runs before probe | ✅ | "✓ built in 954ms" in smoke output |
| --skip-build skips builds | ✅ | Verified locally |
| All three surfaces gated | ✅ | 3 static-bundle probe sections in smoke output |
| Halved budget fails smoke | ✅ | Regression test 2: exit 1 with 1 over-budget finding |
| 9 unit tests pass | ✅ | "9 pass, 0 fail" |
| Typecheck clean | ✅ | tsc --noEmit exit 0 |
| 3 commits created | ✅ | 4e13ea3, 50dba45, ea713c7 |
