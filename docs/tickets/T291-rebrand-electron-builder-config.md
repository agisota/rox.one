# T291 - Rebrand Electron build config and R7 closeout

Status: DONE

## Context

Phase R.7 calls for an audit of `apps/electron/electron-builder.yml`
to confirm `productName: ROX.ONE` and a canonical reverse-DNS `appId`.
The current config carries `appId: com.rox.one` and
`productName: ROX.ONE` — both correct.

The R.7 phase-detail spec listed `one.rox.workbench` as one example of
a canonical reverse-DNS form. The operator instructions for this
specific Ralph cycle asked the executor to "pick a canonical reverse-
DNS name and document the choice in T291's worklog" if a rewrite was
needed.

T291 keeps `com.rox.one` because:

1. It already ships in the v0.9.1 codebase and on every Sentry release;
   rewriting it now would invalidate user macOS keychain entries,
   AppleScript bindings, dock pinning, and Spotlight indexing.
2. `com.rox.one` follows the standard product reverse-DNS convention
   used by the rest of the workspace (the marketing site at
   `https://rox.one` resolves to the same top-level brand surface).
3. The R.0 ADR (0011) does not explicitly require any particular
   appId form; the R.7 phase-detail spec offered `one.rox.workbench` as
   a *suggestion*, not a hard requirement.

## Goal

Lock the current canonical electron-builder metadata
(`productName: ROX.ONE`, `appId: com.rox.one`) under a regression test
and document the appId decision in this ticket's worklog. Append the
R.7 closeout entry in `.swarm/master-roadmap-log.md` plus the R.6
catch-up line that was missed in the upstream R.6 merge.

## Required UI

None.

## Required Data/API

No schema changes.

## Required Automations

Update build/smoke script contracts that assert old stdout redaction markers.

## Required Subagents

None.

## TDD Requirements

The R.7 regression test in
`scripts/__tests__/r7-docker-ci-build.test.ts` includes the assertion
"electron-builder.yml uses the canonical ROX.ONE productName and a
rox-scoped appId". The assertion:

1. `productName: ROX.ONE` appears at column zero on its own line.
2. `appId:` resolves to a value that contains `rox` as a DNS segment.
3. The same `appId:` value contains no `rox` or `agent` token
   (case-insensitive).

## Implementation Requirements

No edits to `apps/electron/electron-builder.yml`. The current values
are already canonical. T291's only deliverable here is the regression
test (added in T289's commit) and this ticket's worklog documenting
the appId decision.

The R.7 closeout commit additionally appends two phase-ledger lines to
`.swarm/master-roadmap-log.md`:

1. The R.6 catch-up line that the upstream R.6 PR (#66) merge did not
   record.
2. The R.7 line for this PR.

## Validation Commands

- `bun test scripts/__tests__/r7-docker-ci-build.test.ts`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `git diff --check`

## Acceptance Criteria

- [ ] R.7 test asserts `productName: ROX.ONE` and rox-scoped `appId`.
- [ ] `electron-builder.yml` is unmodified.
- [ ] `appId: com.rox.one` decision documented in T291 worklog.
- [ ] `.swarm/master-roadmap-log.md` carries both the R.6 catch-up and
      R.7 ledger lines after the closeout commit lands.

## Worklog

Update `docs/worklog/T291-rebrand-electron-builder-config.md`.
