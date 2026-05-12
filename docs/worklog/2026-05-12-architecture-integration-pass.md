# 2026-05-12 Architecture Integration Pass

## Task summary

Autonomous integration pass over the architecture PR stack in `agisota/rox-one-terminal`.

Primary decision: replace conflicting PR #14 with clean PR #22 as the Slice 2 base, then integrate architecture slices by clean cherry-pick/merge only.

Final architecture branch: `integration/2026-05-12-architecture-session-first`

Final local `main` after account/security landing: `83130f3d`

Final code integration commit after the audit/perf extraction pass: `f6e7a343`

Final audit/perf clean-stack branch: `integration/2026-05-12-audit-perf-clean-stack`

## Repo context discovered

- Current `main` already contains the safe PR pack from the earlier integration pass.
- PR #14 (`feat/architecture-slice2-test-fixtures`) is still `CONFLICTING`.
- PR #22 (`feat/architecture-slice2-test-fixtures-clean`) is `MERGEABLE` and is the correct replacement base for #14.
- PR #15 is `MERGEABLE` against its old base, but the branch history includes unrelated audit/perf baggage and would delete safe-pack work if merged blindly.
- SessionManager and storage-scope chains conflict by topology if applied in the old order. Applying session extraction first, then storage tenancy/callers, makes the conflict small and resolvable.
- PR #21/#26 AgentRuntime chain is independent enough to include in the architecture branch after session/storage validation.
- PR #19/#25 account/security chain was first held separate on `integration/2026-05-12-account-security-series`, then replayed onto the validated architecture `main` as `integration/2026-05-12-main-plus-account-security`.
- Audit/perf PRs #2-#10/#23 remain conflicting or mixed and were not blind-merged.
- The only audit/perf patch clean enough to port independently was the WCAG viewport fix from #5/#7 lineage commit `d565232d`.
- After the first integration pass, the D budget lane was rebuilt as a clean stack from the conflicting audit/perf branches because it applied cleanly and could be validated without Playwright/LLM runtime dependencies.

## Integrated items

- #22: merged as cleaner Slice 2 fixture base.
- #15: cherry-picked only clean storage split commits:
  - `e5f81057`
  - `06d8fcd2`
- #16: cherry-picked cleanly.
- #17: cherry-picked cleanly.
- #28: cherry-picked cleanly.
- #18: cherry-picked cleanly.
- #29: cherry-picked; one conflict resolved by porting `DEFAULT_LOCAL_SCOPE` into the extracted session helper files instead of restoring old monolithic `SessionManager` code.
- #21: cherry-picked cleanly.
- #26: cherry-picked cleanly.
- #19/#25: cherry-picked onto the validated architecture `main` through `integration/2026-05-12-main-plus-account-security`, then fast-forwarded into local `main` after targeted and full-gate checks passed.
- #5/#7 lineage: cherry-picked only `d565232d` (`fix(webui): allow pinch-to-zoom`) because it was isolated, had a focused test, and did not depend on the dirty audit runtime stack.
- D budget lane clean-stack:
  - `a04fce29`: add `budget.json` files for user-facing surfaces.
  - `5acdd8ac`: add glob pattern support to `static-bundle`.
  - `8e6d262f`: make `audit:smoke` PATH-portable through `scripts/audit-smoke.sh`.
  - `e8f575ce`: extend `audit-smoke.sh` with static-bundle gate.
  - `928edb89`: build surfaces before bundle gates.
  - `c836fc13`: extend bundle gates to viewer and marketing.

## Account/security follow-up

The old account/security branch diverged from the new architecture `main` by `98 15`, so it was not merged as a branch. Only its 15 unique account/security commits were replayed.

Applied commits:

- `e372531f`: docs account identity slice plan.
- `cf0e3f14`: timing-safe equality audit for webui auth.
- `0ea2c4c3`: sliding-window account session rotation.
- `8ec5775f`: ADR 0006 account identity foundation.
- `76318ee3`: atomic rotation via compare-and-swap on `revokeSession`.
- `b46af73f`: concurrent-rotation regression test.
- `143c03a5`: AST-based timing-safe-equality audit.
- `75205746`: webui rotation race envelope note.
- `91a910eb`: ADR threat-model rows.
- `ad930c0f`: masked email PII in login/register logs.
- `62f27101`: per-user rotation mutex regression test.
- `03b10c13`: per-user rotation mutex implementation.
- `dda02406`: ADR mark rotation mutex implemented.

Skipped wrapper merge commits:

- `67ca4a4e`: old merge-base wrapper for account identity hardening; no separate payload needed after replaying its second-parent commits.
- `69563ec5`: old merge-base wrapper for account security follow-up; no separate payload needed after replaying its second-parent commits.

## Audit/perf extraction follow-up

The audit/perf branches were reviewed as extraction candidates, not merge candidates.

Findings:

- #1 static audit package is already present from the safe integration pack.
- #10's actual PNG optimization is already present: both `apps/electron/src/renderer/assets/pzdrk.png` and `apps/marketing/src/assets/pzdrk.png` are 146720 bytes, and build output reports the optimized `pzdrk` asset at 146.72 kB. The branch itself was not merged because it carries the dirty D/audit stack.
- #2/#3/#4/#8/#9/#23 depend on audit runtime harness files that are not present in current `packages/audit`; these need a clean rebuild/rebase rather than cherry-picking into current `main`.
- #5/#7 originally contained budget and smoke-script work coupled to missing `scripts/audit-smoke.sh` / budget infrastructure; the D budget subset was later rebuilt as a clean stack and validated.
- `d565232d` was cleanly cherry-picked because it only updates the WebUI viewport policy and adds a direct regression test.

Cherry-picked audit/perf commit:

- `d565232d`: `fix(webui): allow pinch-to-zoom (WCAG 2.2 1.4.4)` -> landed locally as `f6e7a343`.

Clean-stack audit/perf subset:

- Budget files and static-bundle glob support were ported from the D lineage.
- `scripts/audit-smoke.sh` now runs static-tsc plus static-bundle gates for webui, viewer, and marketing after building each surface.
- Electron budget remains a placeholder and is excluded from the smoke script because the current branch has no matching Vite dist bundle for `apps/electron/budget.json`.

## Rejected / held items

- #14: do not merge; use #22 instead.
- #15 as a whole branch: do not merge blindly; it carries unrelated audit/perf history and destructive deltas against safe-pack work.
- #19/#25 old branch shape: do not merge the branch object directly; use the replayed `integration/2026-05-12-main-plus-account-security` shape already landed into local `main`.
- #2/#3/#4/#6/#8/#9/#23: conflicting runtime/route/LLM audit set; do not blind merge. Remaining runtime audit work needs a clean stack on top of current `main`.
- A.2/A.4/A.3 runtime/route/LLM branches: still held because they add Playwright lifecycle, route crawling, dev-server orchestration, and Anthropic SDK taste pass together with old-base history.

## Files inspected / touched by integration

- `packages/test-fixtures/**`
- `packages/shared/src/config/storage*.ts`
- `packages/shared/src/agent/**`
- `packages/core/src/runtime/**`
- `packages/server-core/src/sessions/**`
- `packages/server-core/src/handlers/**`
- `packages/server-core/src/accounts/**`
- `packages/server-core/src/webui/**`
- `apps/webui/src/index.html`
- `apps/webui/tests/index-html.test.ts`
- `apps/*/budget.json`
- `packages/audit/src/probes/static-bundle.ts`
- `packages/audit/tests/probes/static-bundle.test.ts`
- `scripts/audit-smoke.sh`
- `apps/electron/src/main/**`
- `docs/decision-records/audit-harness/**`

## Conflict resolution

Conflict: PR #29 commit `aef1163b` expected old `SessionManager.ts` topology.

Resolution:

- Kept the session-first extracted helper structure from #16/#17/#28.
- Applied scope migration to:
  - `SessionManager.ts`
  - `session-auth.ts`
  - `session-persistence.ts`
  - `session-manager-helpers.ts`
- Verified no conflict markers or whitespace errors remained.

## Validation commands run

- `bun install --frozen-lockfile`
- `bun run typecheck:all`
- `bun run test:rtl`
- `bun run build`
- `bun run e2e:core`
- `bun run electron:smoke:packaged:mac`
- `bun test apps/webui/tests/index-html.test.ts`
- `bun run webui:typecheck`
- `bun run webui:build`
- `bun test apps/electron/src/renderer/components/workbench/__tests__/workbench-route-page.test.tsx apps/electron/src/renderer/components/workbench/__tests__/experience-screens-localization.test.tsx apps/electron/src/renderer/components/workbench/__tests__/deep-missions-screen.test.tsx apps/electron/src/renderer/components/workbench/__tests__/mission-control-run-detail.test.tsx apps/electron/src/renderer/components/workbench/__tests__/arena-builder-screen.test.tsx apps/electron/src/renderer/components/workbench/__tests__/experience-real-state-binding.test.tsx apps/electron/src/renderer/components/workbench/__tests__/experience-global-hud.test.tsx apps/electron/src/renderer/components/workbench/__tests__/artifact-screens.test.tsx apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-flow.test.ts apps/electron/src/renderer/pages/settings/__tests__/account-auth-panel.test.tsx`
- `open apps/electron/release/mac-arm64/ROX.ONE.app`
- `pgrep -fl 'ROX.ONE|Electron|Craft'`
- `bun test packages/audit/tests/probes/static-bundle.test.ts packages/audit/tests/cli.test.ts packages/audit/tests/reporters/json-queue.test.ts`
- `cd packages/audit && bun run tsc --noEmit`
- `bun run audit:smoke`

Targeted checks also run during integration:

- Slice 2 fixture tests: 433 pass, 11 skip.
- Storage split tests: 63 pass.
- Session extraction tests: 70 pass.
- Storage scope plus session tests after #18/#29: 101 pass.
- AgentRuntime/PendingRequestMap/BackendStderrBuffer tests: 17 pass.
- Account/security targeted tests: 44 pass across `auth-rotation`, `auth-timing`, `logging-helpers`, and `account-http`.
- WebUI viewport regression test after audit/perf cherry-pick: 1 pass.
- UI surface targeted test after final evidence commit: 61 pass across 10 files covering six Experience tabs, demo sessions/action metadata, account auth tabs, and composer artifact/quick-action routing.
- Packaged app launch proof: `open apps/electron/release/mac-arm64/ROX.ONE.app` started `ROX.ONE` plus GPU/network/renderer helper processes.
- Audit/perf D clean-stack targeted tests: 16 pass across static-bundle, CLI, and JSON queue reporter tests.
- Audit package typecheck: passed.
- `audit:smoke`: passed; static-tsc plus webui/viewer/marketing static-bundle gates produced 0 findings after building each gated surface.

## Passing output summary

- `bun install --frozen-lockfile`: passed.
- `bun run typecheck:all`: passed.
- `bun run test:rtl`: 8 files passed, 52 tests passed.
- `bun run build`: passed; retained existing large chunk warnings.
- `bun run e2e:core`: all core scenarios passed.
- `bun run electron:smoke:packaged:mac`: packaged headless startup passed.

Additional account/security branch gate before fast-forward to `main`:

- `bun test packages/server-core/src/webui/__tests__/auth-rotation.test.ts packages/server-core/src/webui/__tests__/auth-timing.test.ts packages/server-core/src/webui/__tests__/logging-helpers.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts`: 44 tests passed.
- `bun run typecheck:all`: passed.
- `bun run test:rtl`: 8 files passed, 52 tests passed.
- `bun run e2e:core`: all core scenarios passed.
- `bun run build`: passed; retained existing large chunk warnings.
- `bun run electron:smoke:packaged:mac`: packaged headless startup passed.
- `bun test apps/webui/tests/index-html.test.ts`: 1 test passed.
- `bun run webui:typecheck`: passed.
- `bun run webui:build`: passed; retained existing large chunk warnings and emitted the optimized `pzdrk` asset at 146.72 kB.
- Targeted UI surface tests: 61 tests passed, 0 failed, 673 expectations across Experience, account auth, and composer artifact routing files.
- Packaged `ROX.ONE.app`: process tree is running from `apps/electron/release/mac-arm64/ROX.ONE.app/Contents/MacOS/ROX.ONE`.
- `bun test packages/audit/tests/probes/static-bundle.test.ts packages/audit/tests/cli.test.ts packages/audit/tests/reporters/json-queue.test.ts`: 16 tests passed, 0 failed.
- `cd packages/audit && bun run tsc --noEmit`: passed.
- `bun run audit:smoke`: passed with 0 findings across static-tsc, webui static-bundle, viewer static-bundle, and marketing static-bundle.

## Remaining risks

- The result is local only; no push or PR creation was performed.
- Audit/perf runtime/route/LLM branches still need a separate clean stack; they are not safe for blind merge.
- Live desktop click-through through `Computer Use` was blocked by macOS Apple Events/Accessibility error `-1743`; the packaged app did launch and visible UI surfaces were covered by targeted renderer tests, e2e core, Electron startup smoke, and packaged smoke.

## Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Replace #14 with cleaner base if needed | Pass | #14 conflicting, #22 merged cleanly |
| Integrate architecture stack safely | Pass | #22 + clean #15 + #16/#17/#28 + #18/#29 + #21/#26 |
| Integrate account/security safely | Pass | #19/#25 commits replayed on clean architecture base and fast-forwarded |
| Avoid blind audit/perf merges | Pass | Conflicting audit/perf branches held; only `d565232d` cherry-picked |
| Resolve conflicts intentionally | Pass | #29 scope conflict ported into extracted helpers |
| Full quality gate | Pass | install, typecheck, RTL, build, e2e core, packaged smoke |
| Keep old wrapper merges out | Pass | `67ca4a4e` and `69563ec5` skipped as old merge wrappers |
| Port isolated audit/perf value | Pass | WebUI pinch-zoom fix cherry-picked and validated with test/typecheck/build |
| Validate product UI surfaces | Partial | 61 targeted renderer tests passed and packaged app launched; desktop click automation blocked by macOS `-1743` |
| Rebuild D budget lane cleanly | Pass | Budget files, glob static-bundle, and build-before-bundle smoke gate validated |
