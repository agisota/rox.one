# T287 - Rebrand env-var docs update

Status: IN_PROGRESS

## Context

After T285 (shim) and T286 (call-site migration), the canonical env-var
names in operator-facing surfaces still mention `CRAFT_*` as primary. T287
rewrites the operator surface to use `ROX_*` first and notes legacy names
as deprecated.

## Goal

Every operator-facing surface that names one of the 16 canonical env vars
uses `ROX_*` as primary. Legacy `CRAFT_*` names remain mentioned only as a
"Deprecation" note where helpful for one-version migration.

Files in scope (operator surface, NOT historical worklogs):

- `README.md` — every `CRAFT_SERVER_*` / `CRAFT_RPC_*` / `CRAFT_DEBUG`
  reference becomes `ROX_*`.
- `Dockerfile.server` — `ENV CRAFT_*` lines become `ENV ROX_*`; add a comment
  noting the runtime shim still reads `CRAFT_*` for one minor version.
- `.env.example` — rewrite the 16 canonical variable names to `ROX_*`.
- Root `package.json` scripts that use `CRAFT_*` inline (line 34
  `server:dev`, lines 89-91 `electron:dist:dev:*`) — rewrite to `ROX_*`.
- Any other `*.md` in `docs/` referencing the 16 canonical names in
  *instructional* prose. Historical worklogs and decision records remain
  immutable per the legal-preserve / immutability rules.

Out of scope (do not touch):

- `LICENSE`, `NOTICE`, `TRADEMARK.md`.
- The `org.opencontainers.image.source` label in `Dockerfile.server`.
- `docs/worklog/T*` with `Status: DONE`.
- `apps/electron/resources/release-notes/*.md`.
- Variables NOT in the canonical 16 list (those are R.7+ work).

## Required UI

None.

## Required Data/API

None.

## Required Automations

The rebrand validator allowlist already covers historical worklogs.
Updates to `README.md`, `Dockerfile.server`, `.env.example`, and root
`package.json` shrink the `CRAFT_` finding count.

## Required Subagents

None.

## TDD Requirements

Doc/config-only changes are covered indirectly by `bun run validate:rebrand`.
A reduction in `CRAFT_` findings (with no regression elsewhere) is the
acceptance test.

## Implementation Requirements

For each operator surface:

1. Replace the canonical `CRAFT_<name>` token with `ROX_<name>`.
2. Where the surface needs to teach operators about the shim, add a single
   "Deprecation" sentence: "Legacy `CRAFT_<name>` is still accepted via
   the readEnv() shim for one minor version; please migrate."

## Validation Commands

- `bun run validate:rebrand` (must show strictly fewer findings than baseline)
- `bun run validate:roadmap` (no new errors introduced)
- `bun run lint`
- `bun run typecheck`

## Acceptance Criteria

- [ ] README primary text uses `ROX_*` everywhere.
- [ ] `.env.example` lists only `ROX_*` names for the canonical 16.
- [ ] `Dockerfile.server` `ENV` lines and `package.json` scripts use `ROX_*`.
- [ ] Deprecation note present where operators encounter the shim.
- [ ] No legal-preserve surface modified.

## Worklog

Update `docs/worklog/T287-rebrand-env-var-docs-update.md`.
