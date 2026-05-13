# Decision 0011: ROX.ONE Rebrand Canonical Tokens

- Status: accepted
- Date: 2026-05-13
- Implements: Phase R.0 of the ROX.ONE rebrand sweep
- Mapping report: `docs/release/rebrand-mapping-2026-05-13.md`

## Context

The repository is a white-label fork moving from legacy upstream product
branding to the ROX.ONE Agent Workbench Suite. The rebrand goal inserts this
work as Phase 1.7 after the C4 storage-isolation follow-ups and before the RBAC
slice, because package-scope and import-path renames would otherwise collide
with active C4 work.

The operator locked the core brand decisions on 2026-05-13 before any rebrand
implementation was authorized.

## Decision

Use these canonical tokens throughout new product, code, package, and
documentation surfaces:

- **Written product wordmark:** `ROX.ONE`.
- **Spoken form:** `ROX ONE`, reserved for voice-over or marketing audio only.
  It must not be used as a source-code or package token.
- **Suite descriptor:** `Agent Workbench Suite` where context needs the broader
  product-family name.
- **Package scope:** `@rox-one/*`.
- **Environment variable prefix:** `ROX_*` for all new variables.

Legacy `CRAFT_*` environment variables remain readable for one minor version
through the Phase R.6 `readEnv()` compatibility shim. The shim must emit a
per-process deprecation warning when a legacy variable supplies a value.

## Legal Preserve Boundary

The rebrand renames the product. It does not erase upstream attribution or
historical records required by Apache 2.0 section 4.

These paths may retain legacy names when they are attribution, legal, or
historical evidence:

- `LICENSE`
- `NOTICE`
- `TRADEMARK.md`
- `Dockerfile.server`, limited to the `org.opencontainers.image.source` label
- `README.md`, limited to License and Acknowledgements sections
- `docs/decision-records/`
- `docs/worklog/T0*-*.md`
- `docs/tickets/T0*-*.md`
- `docs/worklog/T1*-*.md`
- `docs/tickets/T1*-*.md`
- `docs/worklog/T2*-*.md`
- `docs/tickets/T2*-*.md`
- `apps/electron/resources/release-notes/`
- `plan.md`
- `snapshot.md`
- `.brv/`
- `.swarm/`
- `.git/`

All other current findings are tracked in the mapping report and must be
removed or explicitly reclassified by later rebrand phases.

## Consequences

- Later rename phases have a single source of truth for the written brand,
  package scope, env-var prefix, and temporary compatibility behavior.
- The rebrand lint gate can fail closed on legacy product branding while
  preserving legal attribution paths.
- Package-scope and env-var migrations become intentional compatibility work
  rather than ad hoc search-and-replace.
- Historical tickets and worklogs remain immutable after completion, preserving
  the evidence trail for shipped work.

## Follow-Up Tickets

- T260 records this ADR.
- T261 records the current rebrand mapping report.
- T262 adds the automated rebrand lint gate.
- T263 through T298 execute and close the remaining rebrand phases.

## Verification Gates

- `test -f docs/decision-records/audit-harness/0011-rox-one-rebrand-canonical-tokens.md`
- `bun run validate:docs`
- `git diff --check`
