# T120 - Fresh Bundle Release Evidence Reconciliation Worklog

## 1. Task summary

Reconcile release documentation with T119 fresh bundle evidence so the release
handoff points at the clean build measurement command instead of only the older
T092 read-only bundle report.

Initial state:

```text
## mac/rox-production-ready-rc...origin/mac/rox-production-ready-rc [ahead 22]
```

## 2. Repo context discovered

- T119 is complete and committed.
- T119 added `bun run report:bundle-artifacts:fresh`.
- T119 proved that the old T092 WebUI baseline included stale hashed build
  outputs: `632` JS files / `158,242,602` bytes (`150.91 MB`).
- The fresh WebUI baseline is `305` JS files / `17,464,023` bytes
  (`16.65 MB`).
- Release docs still mention the older `report:bundle-artifacts` evidence in
  their readiness/final-RC summaries.
- The remaining risk did not disappear: clean outputs still contain large JS
  chunks, and bundle-size warnings are still non-fatal.

## 3. Files inspected

- `docs/release/production-readiness-matrix-2026-05-06.md`
- `docs/release/current-state-snapshot-2026-05-06.md`
- `docs/release/final-rc-2026-05-06.md`
- `docs/tickets/T105-release-handoff-current-evidence.md`
- `docs/worklog/T105-release-handoff-current-evidence.md`
- `docs/tickets/T119-fresh-bundle-artifact-report.md`
- `docs/worklog/T119-fresh-bundle-artifact-report.md`

## 4. Tests added first

Docs-only red check:

```bash
rg -n "report:bundle-artifacts:fresh|T119|17,464,023|16\\.65 MB" docs/release docs/tickets/T105-release-handoff-current-evidence.md docs/worklog/T105-release-handoff-current-evidence.md
```

Expected result before implementation: FAIL/no matches in the release-handoff
docs, because they still reference the older T092 command/evidence.

## 5. Expected failing test output

Red command before implementation:

```bash
rg -n "report:bundle-artifacts:fresh|T119|17,464,023|16\\.65 MB" docs/release docs/tickets/T105-release-handoff-current-evidence.md docs/worklog/T105-release-handoff-current-evidence.md
```

Actual result before implementation: FAIL with exit code `1` and no matches.

## 6. Implementation changes

- Updated `docs/release/production-readiness-matrix-2026-05-06.md` to use T119
  `report:bundle-artifacts:fresh` as the current bundle evidence source.
- Updated `docs/release/current-state-snapshot-2026-05-06.md` to describe the
  T098-T120 continuation and replace the stale read-only T092 baseline language
  with T119 fresh clean-build baseline language.
- Updated `docs/release/final-rc-2026-05-06.md` to list T105-T120, add the T119
  fresh bundle validation summary, and keep large chunks as a remaining
  non-fatal risk.
- Added T120 addenda to the T105 ticket/worklog so the current release-handoff
  docs point at the T119 fresh bundle evidence without rewriting T105's
  historical T098-T104 scope.

## 7. Validation commands run

```bash
rg -n "report:bundle-artifacts:fresh|T119|17,464,023|16\\.65 MB" docs/release docs/tickets/T105-release-handoff-current-evidence.md docs/worklog/T105-release-handoff-current-evidence.md
bun run validate:docs
git diff --check
git status --short -- package.json bun.lock apps/electron/package.json
git status --short --branch
```

## 8. Passing test output summary

Targeted docs evidence check: PASS. Matches now exist in:

- `docs/release/production-readiness-matrix-2026-05-06.md`
- `docs/release/final-rc-2026-05-06.md`
- `docs/release/current-state-snapshot-2026-05-06.md`
- `docs/tickets/T105-release-handoff-current-evidence.md`
- `docs/worklog/T105-release-handoff-current-evidence.md`

Docs validation:

```text
[agent-contract] ok: 11 skills, 121 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated /Users/marklindgreen/Projects/craft/craft/docs/architecture/sync-v2-design.md
```

Whitespace:

```text
git diff --check
```

Result: PASS with no output.

Dependency manifest/package hygiene:

```text
git status --short -- package.json bun.lock apps/electron/package.json
```

Result: PASS with no output.

## 9. Remaining risks

- T120 reconciles documentation only; it does not rebuild bundles or change
  runtime behavior.
- T119's fresh measurement closes stale-output risk for the current bundle
  baseline, but large JS chunks remain and still need a separate budget or
  chunk-splitting policy before becoming a CI gate.
- Public production remains blocked by the existing provider, hosted
  infrastructure, signing/notarization, dependency remediation or signed
  accepted-risk approval, and external security-review requirements.

## 10. Acceptance criteria matrix

| Criteria | Status | Evidence |
|---|---|---|
| Worklog captures stale release evidence before implementation | Done | Sections 1-5 |
| Targeted docs evidence check fails before implementation | Done | Section 5 |
| Release docs cite T119 fresh bundle evidence | Done | Section 8 targeted docs matches |
| Release docs cite `report:bundle-artifacts:fresh` | Done | Section 8 targeted docs matches |
| Fresh WebUI clean-build total replaces stale T092 total as current baseline | Done | Section 8 targeted docs matches |
| Large chunks remain documented as non-fatal risk | Done | Sections 6 and 9 |
| Private RC versus public production boundary is unchanged | Done | Sections 6 and 9 |
| Docs validation passes | Done | Section 8 |
| Worklog is complete | Done | Sections 1-10 |
| Scoped Lore commit exists | Done | This T120 Lore commit |
