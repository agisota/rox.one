# T298b-rc-preflight-runner - Machine-executable runner for the RC pre-flight checklist (M.20)

Status: DONE
Phase: M.20 (RC validation gate)
Ticket: docs/tickets/T298b-rc-preflight-runner.md
Sibling: docs/tickets/T298-rc-preflight.md (checklist authoring — frozen)
Spine: docs/superpowers/goals/2026-05-13-rox-one-v1-end-to-end-spine-goal.md
Master roadmap: docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md Phase 20

## 1. Task summary

Add the executable companion to T298's RC pre-flight checklist. The
runner parses §1 of `docs/release/v1-rc-preflight-checklist.md` to
discover the ordered list of `validate:*` gates, runs each one via
`Bun.spawn`, captures exit code plus a stdout/stderr tail plus
wall-clock duration, prints a green/red table, and exits non-zero if
any gate fails. `--continue-on-failure` keeps walking past a red;
default short-circuits.

## 2. Repo context discovered

- T298 froze `docs/release/v1-rc-preflight-checklist.md`. The runner
  is a strict reader of that doc — never a writer.
- The checklist quotes every `validate:*` script verbatim inside
  inline backticks (`` `bun run validate:<name>` ``). §1 is a markdown
  table whose left column carries those backtick spans; §1 also carries
  one trailing aggregate-gate callout for `validate:ci`. The runner
  excludes the three known aggregates (`validate:ci`, `validate:release`,
  `validate:dev`) so individual gates are not double-counted.
- `package.json` carries 22 `validate:*` script entries today. §1 of
  the checklist quotes 16 of them in the runner's intended run order.
- The repo already uses `Bun.spawn` in `scripts/electron-smoke.ts` and
  across `packages/*/src/__tests__/`, so the spawn idiom matches house
  style. `process.argv.includes(...)` is the codebase convention for
  ad-hoc flags in `scripts/*.ts`.
- `scripts/__tests__/` uses `bun:test` (`describe`/`test`/`expect`,
  `beforeAll`/`afterAll`). Other tests do not mock `Bun.spawn`; the
  cleanest mock-free approach is to write tiny fixture projects under
  `tmpdir()` and spawn `bun run validate:<name>` against them.

## 3. Files inspected

- `docs/release/v1-rc-preflight-checklist.md` (source of truth; not modified)
- `docs/tickets/T298-rc-preflight.md`, `docs/worklog/T298-rc-preflight.md`
- `docs/tickets/TEMPLATE.md`, `docs/worklog/README.md`
- `package.json` (validate:* scripts + injection point for `rc:preflight`)
- `scripts/electron-smoke.ts` (`Bun.spawn` precedent)
- `scripts/__tests__/rebrand-asset-paths.test.ts`,
  `scripts/__tests__/community-link-audit.test.ts` (test-file house style)
- `scripts/validate-agent-contract.ts`,
  `scripts/validate-rebrand.cjs`,
  `scripts/validate-roadmap-coherence.cjs` (gate behaviour the runner has
  to drive end-to-end)

## 4. Tests added first

`scripts/__tests__/rc-preflight-runner.test.ts` — 8 tests:

1. `parseValidatorGates` extracts §1 gates in document order.
2. `parseValidatorGates` excludes the `validate:ci` aggregate gate.
3. `parseValidatorGates` throws when §1 is missing.
4. `runPreflight` happy path (two passing stub validators).
5. `runPreflight` short-circuits on first red and marks the
   remaining gates `skipped` with a captured stderr tail.
6. `--continue-on-failure` walks every gate after the red.
7. `formatReport` renders the header row, both `pass`/`fail` rows,
   and the `red — N failed` summary line.
8. Missing checklist path throws `checklist missing`.

The failure stub deliberately writes a known `boom-error-text` string
to its stderr so the captured-tail assertion is precise. ≥8 `expect()`
calls; actual total: 30.

## 5. Expected failing test output

Before the runner existed, `runPreflight` and `parseValidatorGates`
imports failed module resolution. The runner landed in the same change
set as the test file, so on first run the suite went straight to 8/8
green.

## 6. Implementation changes

- New `scripts/rc-preflight-runner.ts` (258 LOC).
  - `parseValidatorGates(markdown)` — scans for the §1 heading, slices
    until the next top-level heading, walks every `` `bun run
    validate:<name>` `` backtick span, deduplicates, drops aggregate
    gates.
  - `runGate(name, options)` — single-gate `Bun.spawn` wrapper that
    captures stdout/stderr fully then keeps only the trailing 400
    bytes per stream.
  - `runPreflight(options)` — top-level orchestrator. Short-circuits
    by default; `continueOnFailure: true` walks every gate. Marks
    skipped gates explicitly so the printed table makes the gap
    visible.
  - `formatReport(report)` — fixed-width table with `gate | status |
    duration | stderr-tail` columns plus a final summary line.
  - CLI entry guarded by `import.meta.main`; `--continue-on-failure`
    flag forwarded from `process.argv`.
- New `scripts/__tests__/rc-preflight-runner.test.ts` (200 LOC).
- `package.json` — added `"rc:preflight": "bun run scripts/rc-preflight-runner.ts"`,
  placed adjacent to the `validate:*` block. No other script touched.
- `docs/tickets/T298b-rc-preflight-runner.md`, this worklog.
- `docs/release/v1-rc-preflight-checklist.md` — **NOT TOUCHED** (T298
  freeze respected).
- `.swarm/master-roadmap-log.md` — **NOT TOUCHED** (out of scope).

## 7. Validation commands run

```
bun test scripts/__tests__/rc-preflight-runner.test.ts
bun run rc:preflight --continue-on-failure
bun run validate:rebrand
bun run validate:agent-contract
bun run validate:roadmap
```

## 8. Passing test output summary

```
bun test v1.3.13 (bf2e2cec)
 8 pass
 0 fail
 30 expect() calls
Ran 8 tests across 1 file. [261.00ms]
```

`bun run rc:preflight --continue-on-failure` walked all 16 gates from
§1 of the checklist. Pass: rebrand, agent-contract, roadmap, ci-contract,
e2e-core-scenarios, mac-private-release-boundary, private-release-pipeline,
architecture-docs, sync-v2-design, mac-arm-build-workflow,
mac-boundary-fixtures, docs. Red on a clean checkout: bundle-budget,
bundle-policy, packaged-artifacts, audit — all four depend on a prior
`bun run electron:build` to produce the artifacts they inspect. That
is the runner reporting truth: those four gates require a build step
the operator runs before `rc:preflight` on the tag-candidate SHA.

`bun run validate:rebrand`, `bun run validate:agent-contract`, and
`bun run validate:roadmap` all exit 0.

## 9. Build output summary

No build step in scope — TS source executed directly by Bun. `bun test`
runtime: 261 ms for the 8-test runner suite.

## 10. Remaining risks

- The runner relies on the §1 heading literal `## 1. Validator gates`.
  If a future PR retitles that heading without updating the parser,
  the runner will throw — by design. A parser test (`throws when §1 is
  missing`) covers this surface.
- Gates that depend on build artifacts are red on a clean checkout.
  Documented in the ticket and surfaced explicitly in the printed
  table; the M.21 follow-up will wire the runner into a pre-tag
  workflow that runs `electron:build` first.
- Aggregate-gate exclusion is hard-coded to three names. If a future
  PR introduces a new aggregate (`validate:foo-all`) without updating
  the exclusion list, the runner would double-count its individual
  gates. Low risk for M.20 (no aggregate-gate roadmap entry between
  here and `v1.0.0`).

## 11. Acceptance criteria matrix

| Criterion | Evidence |
| --- | --- |
| Runner source ≤300 LOC | `wc -l scripts/rc-preflight-runner.ts` → 258 |
| Tests ≤250 LOC, ≥8 expects | `wc -l scripts/__tests__/rc-preflight-runner.test.ts` → 200; 30 expects |
| `rc:preflight` script in package.json | `grep 'rc:preflight' package.json` |
| Checklist byte-for-byte unchanged | `git diff origin/main -- docs/release/v1-rc-preflight-checklist.md` → empty |
| Master roadmap log untouched | `git diff origin/main -- .swarm/master-roadmap-log.md` → empty |
| `bun test scripts/__tests__/rc-preflight-runner.test.ts` | 8 pass, 0 fail |
| `bun run validate:rebrand` exit 0 | confirmed |
| `bun run validate:agent-contract` exit 0 | confirmed |
| `bun run validate:roadmap` exit 0 | confirmed |
| Ticket `Status: DONE` | `docs/tickets/T298b-rc-preflight-runner.md` |
| Worklog ticket-id match | this file |
| PR opened against `main` | see PR URL in completion report |
