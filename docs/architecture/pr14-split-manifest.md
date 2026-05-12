# PR #14 Branch Split Manifest

Source branch: `feat/architecture-slice2-test-fixtures` @ `71a6a56`
Merge base with `origin/main`: `5c15830`
Total commits: 81

This manifest classifies every commit between `5c15830..71a6a56` into one of:

- **TF** — Slice 2 test-fixtures consolidation (target: PR 14a)
- **AUDIT** — `packages/audit/*` sub-project A and sub-project D (a11y/perf budgets, audit-smoke wiring) (target: PR 14b)
- **BUILD-INFRA** — CI/build infra that the TF work depends on (target: PR 14a)

## Bucket counts

| Bucket | Count |
|--------|-------|
| TF + BUILD-INFRA | 6 |
| AUDIT | 75 |
| **Total** | **81** |

## TF + BUILD-INFRA commits (PR 14a — `feat/architecture-slice2-test-fixtures-clean`)

In original chronological order (oldest first; cherry-pick order):

| # | SHA | Subject | Bucket |
|---|-----|---------|--------|
| 1 | `93913c0` | chore(test-fixtures): scaffold @craft-agent/test-fixtures package (Slice 2) | TF |
| 2 | `b032f6a` | refactor(shared): extract TEST_MODE_CONFIG into @craft-agent/test-fixtures (Slice 2) | TF |
| 3 | `5bccaab` | fix(test-fixtures): remove cross-package import; keep package as graph leaf (Slice 2) | TF |
| 4 | `660f1dc` | refactor(shared): split mode-manager.test.ts using @craft-agent/test-fixtures (Slice 2) | TF |
| 5 | `33c1094` | chore(ci): collapse validate:ci behind single `bun run test` (Slice 2) | BUILD-INFRA |
| 6 | `71a6a56` | docs(architecture): document test-fixtures + bun run test gate (Slice 2) | TF (docs) |

Notes:

- Commit `8e97816` mentioned in the handoff plan is not present in `5c15830..71a6a56`; the actual mode-manager split commit is `660f1dc`.
- `33c1094` modifies `package.json` `validate:ci` context but the lines it touches (`test` script, `.github/workflows/validate.yml`) match `origin/main`; cherry-pick is clean. The new `validate:ci` body still references `validate:audit` indirectly through the architecture doc (`71a6a56`), but the TF branch's `validate:ci` will not contain `validate:audit` since the audit-wiring commit `9556936` is in bucket AUDIT. This is a documentation-only forward reference — acceptable per handoff plan ("preserve TF intent only").
- `71a6a56` documents `validate:audit` as part of the chain. On the TF-only branch this is a forward reference to the audit sub-project. It will become accurate once 14b lands.

## AUDIT commits (PR 14b — `feat/audit-harness-aggregate`)

75 commits, in chronological order (cherry-pick order):

| # | SHA | Subject |
|---|-----|---------|
| 1 | `fae6237` | feat(audit): design spec for sub-project A audit harness |
| 2 | `474c5fc` | docs(audit): implementation plan for Phase A.1 (static probes) |
| 3 | `2670a46` | feat(audit): bootstrap packages/audit workspace [T060] |
| 4 | `122c131` | chore(audit): drop redundant src/.gitkeep [T060] |
| 5 | `b23df27` | chore(audit): pin exact dep versions per engineering rules [T060] |
| 6 | `cbb33c8` | fix(audit): scope package name to @craft-agent/audit per monorepo convention [T060] |
| 7 | `084c74c` | fix(audit): refresh bun.lock after package rename to @craft-agent/audit [T060] |
| 8 | `dd7c86f` | feat(audit): Probe interface + Finding type with stable id [T060] |
| 9 | `d36ceb7` | feat(audit): ProbeRegistry register + serial run [T060] |
| 10 | `d938298` | feat(audit): ProbeRegistry worker-pool parallelism [T060] |
| 11 | `0795b61` | feat(audit): per-probe timeout + crash isolation with zero-confidence findings [T060] |
| 12 | `ac0ca9c` | fix(audit): optional-chain findings[0] access [T060] |
| 13 | `4b506d7` | fix(audit): clear timeout timer + drop unsafe error cast in worker [T060] |
| 14 | `1324a12` | feat(audit): pure ranker with severity/surface/confidence/VDI weights [T060] |
| 15 | `ebcd865` | feat(audit): JSON queue reporter with atomic write + manifest-last [T060] |
| 16 | `a6cc1e5` | feat(audit): Markdown sidecar reporter, severity-grouped [T060] |
| 17 | `26e27bd` | fix(audit): escape backticks in markdown sidecar + empty-findings test [T060] |
| 18 | `e8cb690` | feat(audit): CLI entrypoint with --help, --probes, --worker-cap, --out [T060] |
| 19 | `918f8b4` | test(audit): tsc-broken fixture with TS2345/TS2322/TS7006 [T061] |
| 20 | `0c3ebac` | feat(audit): static-tsc probe wraps tsc --noEmit, parses diagnostics [T061] |
| 21 | `ff61735` | test(audit): eslint-broken fixture (no-unused-vars, no-console) [T062] |
| 22 | `43e1075` | feat(audit): static-eslint probe parses eslint --format=json [T062] |
| 23 | `5bac8ad` | test(audit): bundle-bloated fixture with budget.json [T063] |
| 24 | `e240209` | feat(audit): static-bundle probe checks dist/ against budget.json [T063] |
| 25 | `d8e9a2e` | feat(audit): ticket-gen creates AGENTS.md ticket stubs from findings [T064] |
| 26 | `506b791` | test(audit): ticket-gen idempotency invariants [T064] |
| 27 | `70b0561` | feat(audit): wire ticket-gen into CLI with --no-tickets and --top-k flags [T064] |
| 28 | `9556936` | feat(audit): wire audit:smoke into validate:ci, first end-to-end run [T064] |
| 29 | `7b97efc` | docs(audit): root README section [T064] |
| 30 | `91b105e` | test(audit): coverage script with 80% gate [T064] |
| 31 | `a9c1820` | docs(audit): T060-T064 tickets + worklogs per AGENTS.md operating contract |
| 32 | `cfb458a` | chore(audit): rename audit tickets+worklogs to T134-T138 |
| 33 | `b0bb35e` | docs(audit): update plan + spec to reference T134-T138 ticket numbers |
| 34 | `5b7d4ae` | feat(audit): add JSON Schemas for Finding and AuditQueue [T134] |
| 35 | `59650ec` | feat(audit): write per-probe/<probe>.json artifacts per spec § 5.1 [T138] |
| 36 | `33b6448` | test(audit): add new-worklog.sh + skip-on-config-absent probe tests [T138] |
| 37 | `b497415` | docs(audit): record skip-on-config-absent tests in worklog acceptance matrices [T138] |
| 38 | `e7d072a` | docs(audit): implementation plan for Phase A.2 (runtime probes + discovery refinement) |
| 39 | `315849c` | chore(audit): add @axe-core/playwright + playwright deps for A.2 [T139] |
| 40 | `e7fc4a3` | feat(audit): surface discovery module with fallback paths [T142] |
| 41 | `8f637e5` | fix(audit): use discovery module in static probes [T142] |
| 42 | `998adaf` | feat(audit): playwright-runner with deterministic viewport, clock, motion [T139] |
| 43 | `08c9395` | feat(audit): runtime-axe probe + fixture (WCAG 2.2 AA) [T140] |
| 44 | `29069c9` | feat(audit): runtime-states probe heuristic check [T141] |
| 45 | `70a1b64` | feat(audit): first A.2 runtime audit run [T143] |
| 46 | `3eb4fbf` | docs(audit): T139-T143 tickets + worklogs for Phase A.2 runtime probes |
| 47 | `73fdd1b` | fix(audit): wrap Playwright lifecycle in try/finally in CLI [T144] |
| 48 | `b779aca` | fix(audit): downgrade runtime-states confidence to 0.5 [T144] |
| 49 | `461a84a` | fix(audit): populate location.route in runtime-axe Findings [T144] |
| 50 | `0decb43` | test(audit): strengthen CLI smoke (round-trip) + manifest-order [T144] |
| 51 | `8e6d262` | chore(audit): make audit:smoke script PATH-portable for CI runners [T144] |
| 52 | `b8af585` | docs(audit): T144 ticket + worklog for A.2 architect-followup cleanup |
| 53 | `d39cbb8` | docs(audit): implementation plan for Phase A.4 (route crawler) |
| 54 | `86957d0` | feat(audit): dev-server-runner with ready-pattern detection [T145] |
| 55 | `40cbaae` | feat(audit): SPA route crawler with bounded BFS [T146] |
| 56 | `1babfe0` | feat(audit): wire route crawler into discoverRoutes [T147] |
| 57 | `ebfdd49` | feat(audit): first A.4 runtime audit with route crawler [T148] |
| 58 | `30fdde7` | docs(audit): T145-T148 tickets + worklogs for Phase A.4 route crawler |
| 59 | `6abc6ec` | docs(audit): implementation plan for Phase A.3 (LLM taste pass) |
| 60 | `e7043f8` | feat(audit): llm-runner with Anthropic SDK + prompt caching + DI [T149] |
| 61 | `865c7a8` | feat(audit): taste-llm probe with screenshot + Sonnet analysis [T150] |
| 62 | `b31ac1f` | docs(audit): A.3 taste-llm probe shipped [T151] |
| 63 | `98021ab` | docs(audit): T149-T151 tickets + worklogs for A.3 LLM taste pass |
| 64 | `ad1f055` | docs(d): design spec for sub-project D (a11y + perf budgets) |
| 65 | `a04fce2` | feat(d): add budget.json files for 4 user-facing surfaces [T153] |
| 66 | `27554cb` | chore(d): extend audit-smoke.sh with static-bundle gate [T154] |
| 67 | `d565232` | fix(webui): allow pinch-to-zoom (WCAG 2.2 1.4.4) [T155] |
| 68 | `0b01849` | test(audit): lock probe registry contract via discovery + import-discipline tests |
| 69 | `1f0b4fc` | docs(d): T153-T155 tickets + worklogs for sub-project D |
| 70 | `0e556f5` | docs(audit): ADR for Finding + Manifest schema (Slice 1) |
| 71 | `6c604fc` | docs(audit): A.5 Electron renderer implementation plan (Slice 1) |
| 72 | `4e13ea3` | feat(audit): static-bundle probe supports glob patterns in budget.json [T156] |
| 73 | `50dba45` | chore(d): audit-smoke runs build before bundle gate [T157] |
| 74 | `ea713c7` | chore(d): extend audit-smoke to viewer + marketing static-bundle gates [T158] |
| 75 | `73b48bc` | docs(audit): T156-T158 ticket + worklog for D-followup architect fixes |

## Cross-bucket dependency notes

1. **`33c1094` (TF)** edits `validate:ci` package.json line in a context that, on `main`, does not include `validate:audit`. The cherry-pick onto a TF-only branch will preserve the original `validate:ci` body. The architecture doc in `71a6a56` references `validate:audit` as part of the chain — this is a forward reference that becomes correct once both branches are merged. Documented in PR 14a body.

2. **`9556936` (AUDIT)** wires `validate:audit` into `validate:ci`. When this is cherry-picked onto a main-based audit branch (without `33c1094`), it edits the original `validate:ci` line on `main`. Clean cherry-pick.

3. **`d565232` (AUDIT)** modifies `apps/webui/src/index.html` to allow pinch-to-zoom — semantically a sub-project D fix surfaced by the audit harness. Belongs with audit (T155).

4. **`0b01849` (AUDIT)** adds a registry-discovery test in `packages/audit/tests/`. Belongs with audit despite being chronologically after the D commits.

No commits genuinely mix TF and AUDIT file paths within a single commit; the split is clean at commit granularity.
