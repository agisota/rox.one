# T230 - RBAC ADR (0009-rbac-policy.md)

Status: DONE

## Context

We are building a white-label fork of Rox Agents OSS into Agent Workbench Suite.

Relevant product goals:

- local desktop app
- managed web/cloud app
- user/team workspaces
- prompt modes
- multi-agent workflows
- validation gates
- TDD-first implementation

T224 through T227 landed the M.2 RBAC backend slices:

- T224 — roles schema (`Role`, `RoleGrant`, `SYSTEM_ROLES`).
- T225 — pure-function policy engine (`evaluate`, `permittedWorkspaces`).
- T226 — `RbacResolver` indirection wired into `deriveScopeFromAuth` via
  `session.permittedWorkspaces`.
- T227 — admin RPC handlers (`roles.list/create/grant/revoke`) plus
  `RoleStore`, `GrantStore` mutation methods, and the
  `RbacResolver.invalidateUser` cache-bust hook.

T228 (admin UI) and T229 (E2E test) run as parallel cycles. T230 is the
closeout ADR for the entire M.2 RBAC phase. It records the design
decisions, the five invariants the engine and resolver hold across the
slice, and the migration path from C.4's "always permit" stub.

The ADR is reserved as decision 0009 in the audit-harness ADR series. It
is the first ADR that documents an enforcement layer (not just a contract
or persistence layout) and therefore cross-references ADR 0007's "Out of
scope" section to close the loop on `session.permittedWorkspaces`
population.

## Goal

Land the closeout ADR for the M.2 RBAC phase as
`docs/decision-records/audit-harness/0009-rbac-policy.md`. Update the
ADR README index to reference the new record and update ADR 0007's
"Out of scope" section to point at ADR 0009 for the
`session.permittedWorkspaces` enforcement story.

## Required UI

None. This is a docs-only ticket.

## Required Data/API

None. The ADR documents existing types (`RoleGrant`, `Role`,
`ScopeKind`, `RbacAction`), the policy engine, the resolver indirection,
the admin RPC surface, and the C.4 migration path — no new code lands.

## Required Automations

None.

## Required Subagents

None.

## TDD Requirements

Docs-only ADR — no executable tests. Validation runs through:

1. `bun run validate:rebrand` — must remain exit 0.
2. `bun run validate:docs` — delta should not introduce new failures.
3. `bun run validate:roadmap` — pre-existing stale rows acceptable, no
   new entries.
4. `git diff --check` — no whitespace errors in the new markdown.

## Implementation Requirements

- Create `docs/decision-records/audit-harness/0009-rbac-policy.md`
  following ADR 0007's structural template:
  - `Status`, `Date`, optional `Implements` line.
  - `## Canonical` — single-sentence summary plus a multi-line technical
    canonical block.
  - Seven numbered decisions, each with rationale.
  - Five invariants list.
  - `## Implementation references` pointing at the M.2 RBAC files.
  - `## Out of scope` section enumerating deferred work (persistence,
    audit logging of grants/revokes, custom role permissions matrix UI,
    org-level RBAC).
- Update `docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md`'s
  "Out of scope" trailing item: append a one-line
  `Updated 2026-05-13 — RBAC enforcement landed via ADR 0009; the 'always
  permit' stub in deriveScopeFromAuth is no longer a stub when an
  `rbacResolver` is wired into HandlerDeps` note (mirrors how ADR 0005
  cross-references ADR 0007).
- Update `docs/decision-records/audit-harness/README.md` to add a new
  table row:
  `| 0009 | [RBAC policy](./0009-rbac-policy.md) | accepted |`.
- Add the worklog `docs/worklog/T230-rbac-adr.md` (11-section template).
- Do not edit `.swarm/master-roadmap-log.md` (centralised append).

## Validation Commands

- `bun run validate:docs` (delta check)
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `git diff --check`

## Acceptance Criteria

- [ ] `docs/decision-records/audit-harness/0009-rbac-policy.md` exists
      with canonical + 7 decisions + 5 invariants + impl refs + out-of-scope.
- [ ] ADR 0007's "Out of scope" section has a one-line cross-reference to
      ADR 0009.
- [ ] ADR README index has a new row for ADR 0009.
- [ ] Worklog complete (11 sections).
- [ ] `validate:rebrand` exits 0.
- [ ] Commit created.

## Out of scope for this cycle

T228 (admin UI) and T229 (RBAC E2E) run in parallel cycles. T230 only
ships the ADR plus the index/cross-reference updates. The persistence
layer beyond the in-memory `GrantStore`/`RoleStore` defers to M.6.
Audit logging of grants/revokes defers to M.14. Org-level RBAC and the
admin UI for custom role permission matrices remain future phases.

## Worklog

Update `docs/worklog/T230-rbac-adr.md`.
