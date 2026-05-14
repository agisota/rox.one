# T298a - Rebrand allowlist expansion (R.9.5 — shim-preservation surfaces)

Status: DONE

## Context

We are building a white-label fork of Rox Agents OSS into Agent Workbench Suite.

Phase R.9.5 is an **interstitial** rebrand phase inserted between R.9
(community-link audit, merged at `b2f7c7c`) and R.10 (final-sweep
ticket). Earlier rebrand phases (R.0–R.9) covered runtime mechanics
(package scopes, env-var shim, Docker/CI build config, user-data
migration, community links). They did NOT cover the policy decision
about which **surfaces** should remain referencing legacy `ROX_*` /
`rox-agent` tokens.

That decision is now made: every surface listed in this ticket is a
**shim-preservation surface** — files where the legacy token continues
to exist on purpose, because the R.6 `readEnv()` shim, the R.7 builder
config, the R.8 user-data migration, and the package.json bin-name
carve-out all *require* the legacy token to keep working for one
minor version.

`bun run validate:rebrand` currently exits 1 with 1443 forbidden-token
findings across 225 tracked files. Without this ticket the next R.N
phase cannot reach green. T298a is the allowlist policy expansion.

Relevant product goals (unchanged from TEMPLATE.md):

- local desktop app
- managed web/cloud app
- user/team workspaces
- prompt modes
- multi-agent workflows
- validation gates
- TDD-first implementation

## Numbering note

The spine document reserves T298 for the R.11 closeout, T299 for the
spine-integration ticket (already created), and T300 for the
v1.1.0 planning ticket. R.9.5 was inserted after those numbers were
allocated. To avoid collision, R.9.5 uses suffixed identifiers
**T298a / T299a / T300a**. This carve-out is documented in this ticket
and referenced from the R.9.5 commit messages and PR body.

## Goal

Extend the legal-preserve / shim-preservation allowlist in
`scripts/validate-rebrand.cjs` so that `bun run validate:rebrand`
exits 0 once the small set of T299a + T300a runtime literal-text
edits land.

Outcome: future rebrand-related work has a clean gate. Any *new*
appearance of a forbidden token outside the allowlist remains a hard
failure.

## Required UI

None. Build-time validation script only.

## Required Data/API

None.

## Required Automations

`bun run validate:rebrand` is already part of the validation matrix.
No new triggers needed.

## Required Subagents

None — single-file edit with a deterministic outcome.

## TDD Requirements

The "test" for this phase IS `bun run validate:rebrand` returning 0
after T298a + T299a + T300a all land. Concretely:

1. From clean origin/main worktree, run `bun run validate:rebrand` and
   record the failing exit code, finding count, and per-token
   distribution in this ticket's worklog (§5).
2. Apply T298a's `scripts/validate-rebrand.cjs` edits.
3. Re-run `bun run validate:rebrand`; the per-token distribution
   shrinks to the residual unambiguous misses (covered by T299a /
   T300a).
4. After T299a + T300a land, re-run `bun run validate:rebrand`; expect
   exit 0.
5. R.0–R.9 regression tests continue to pass:
   - `bun test scripts/__tests__/rebrand-surface-text.test.ts`
   - `bun test scripts/__tests__/community-link-audit.test.ts`
   - `bun test packages/shared/src/config/__tests__/user-data-migration.test.ts`
   - `bun test packages/shared/src/utils/__tests__/env-compat.test.ts`

## Implementation Requirements

Edit `scripts/validate-rebrand.cjs`:

1. Extend `isWholeFileAllowlisted(path)` with the operator-authorized
   shim-preservation surfaces:
   - `.env.example` — documents the legacy `ROX_*` env-var names per
     the R.6 readEnv shim contract.
   - `.github/workflows/*.yml` — CI env-var blocks fed into the shim.
   - `apps/electron/resources/bin/*` — shell stubs that reference
     `$ROX_UV`, `$ROX_SCRIPTS`, `$ROX_BUN`, `$ROX_CLI_ENTRY`
     (shim-fed runtime env vars).
   - `apps/electron/resources/permissions/default.json` — permission
     patterns for legacy install layouts; explicitly preserved per
     R.10 spec.
   - `docs/architecture/` — rebrand-mapping and design docs that
     intentionally cite legacy names.
   - `docs/audits/` — audit history records.
   - `docs/release/` — release notes + rebrand mapping document.
   - `docs/superpowers/` — goal/plan/spec files that define the
     rebrand scope by necessarily mentioning legacy names.
   - `.omc/` — workflow state (same class as `.brv/`, `.swarm/`).
   - `.omx/` — workflow state (same class as `.omc/`).
   - `docs/cli.md` — documents the kept `rox-cli` bin name.
   - `apps/cli/` — CLI app keeps the `rox-cli` bin and help-text
     references for one minor version (deliberate carve-out).
   - `apps/electron/eslint.config.mjs` — internal ESLint plugin name
     `'rox-agent'`; internal-only, no user impact.

2. Extend `isLineAllowlisted(path, lineNumber, line, token, …)` with
   token-specific carve-outs:
   - `packages/shared/src/sources/builtin-sources.ts` — preserve the
     legacy `builtin-rox-agents-docs` id / `rox-agents-docs` slug
     for one minor version (documented in T300a's runtime edit).
   - `packages/shared/src/i18n/locales/*.json` — preserve i18n keys
     containing `RoxAgents` / `loginWithRox` (translation keys are
     stable identifiers per the i18n parity contract).
   - i18n values mentioning `ROX_SERVER_TOKEN` — shim-preserved env
     var; messages remain functionally correct until the next minor
     drops the shim.

3. Each new entry MUST carry a one-line `// Allowlist reason:` comment
   citing the operator authorization or the shim contract.

## Validation Commands

- `bun run validate:rebrand` — MUST exit 0 after T298a + T299a + T300a
  all land.
- `bun test scripts/__tests__/rebrand-surface-text.test.ts`
- `bun test scripts/__tests__/community-link-audit.test.ts`
- `bun test packages/shared/src/config/__tests__/user-data-migration.test.ts`
- `bun test packages/shared/src/utils/__tests__/env-compat.test.ts`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`

## Acceptance Criteria

- [ ] `scripts/validate-rebrand.cjs` carries the new allowlist
      entries with per-entry `// Allowlist reason:` comments.
- [ ] `bun run validate:rebrand` exits 0 after T298a + T299a + T300a
      land.
- [ ] R.0–R.9 regression tests continue to pass.
- [ ] `bun run typecheck` and `bun run lint` green.
- [ ] `.swarm/master-roadmap-log.md` carries the R.9.5 ledger line.
- [ ] Worklog complete (11 sections).
- [ ] Commit created with the Lore protocol.

## Worklog

Update `docs/worklog/T298a-rebrand-allowlist-expansion.md`.
