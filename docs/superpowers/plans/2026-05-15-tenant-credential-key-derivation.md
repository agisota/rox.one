# Tenant Credential Key Derivation - Implementation Plan

> Follow the repository TDD loop. Update
> `docs/worklog/T217-tenant-credential-key-derivation.md` after each
> evidence-bearing step.

**Goal:** Add tenant-specific encryption keys for workspace-scoped credential
stores while preserving the flat single-user credential file.

**Spec:** `docs/superpowers/specs/2026-05-15-tenant-credential-key-derivation-design.md`

**Ticket:** `docs/tickets/T217-tenant-credential-key-derivation.md`

**Branch:** `chore/phase-1-ticket-renumbering`

## Files Created

| Path | Responsibility |
| --- | --- |
| `packages/shared/src/credentials/__tests__/tenant-key-derivation.test.ts` | Covers flat compatibility, tenant fallback/write split, KDF metadata, cross-tenant decrypt rejection, and audit events. |
| `docs/superpowers/specs/2026-05-15-tenant-credential-key-derivation-design.md` | Locks the Phase 1.4 credential key derivation design. |
| `docs/tickets/T217-tenant-credential-key-derivation.md` | Ticket contract for the implementation. |
| `docs/worklog/T217-tenant-credential-key-derivation.md` | Evidence log with red/green validation and acceptance matrix. |

## Files Modified

| Path | Change |
| --- | --- |
| `packages/shared/src/credentials/manager.ts` | Accept a branded scope, build tenant primary plus flat fallback backends, keep default singleton flat. |
| `packages/shared/src/credentials/backends/secure-storage.ts` | Resolve credential file by scope, derive tenant HKDF keys, write versioned tenant store metadata, emit audit events. |
| `packages/shared/src/credentials/index.ts` | Export any new public credential-scope types or reset helpers needed by tests. |
| `docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md` | Correct Phase 1 ticket reservations after T216 was consumed by Phase 1.3. |
| `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md` | Keep the rebrand blocker aligned with the shifted Phase 1 closeout ticket. |

## Tasks

- [x] **Task 1: Repair roadmap ticket reservations**
  - Update Phase 1.3 to record the landed `T216` ticket.
  - Move Phase 1.4 to `T217`, Phase 1.5 to `T218`-`T221`, Phase 1.6 to
    `T222`, and Phase 1 closeout to `T223`.
  - Shift unstarted future roadmap reservations beginning at Phase 2 by one
    slot so no future ticket collides with Phase 1 closeout.

- [x] **Task 2: Write credential red tests**
  - Add `tenant-key-derivation.test.ts`.
  - Prove flat single-user path remains flat.
  - Prove tenant fallback reads existing flat credentials before tenant writes.
  - Prove tenant writes use a versioned KDF envelope.
  - Prove tenant B cannot decrypt tenant A's copied credential file.
  - Prove read/write audit events emit.

- [x] **Task 3: Implement scoped credential manager construction**
  - Add a constructor scope with `DEFAULT_LOCAL_SCOPE` as the default.
  - Keep `getCredentialManager()` returning the default flat singleton for
    existing callers.
  - Add per-scope singleton caching for future tenant-aware callers without
    caching raw scope literals.

- [x] **Task 4: Implement tenant-aware secure storage backend**
  - Resolve file path from the branded scope.
  - Keep local flat credentials at `<configDir>/credentials.enc`.
  - Route active workspace scopes to
    `<configDir>/tenants/<workspaceId>/credentials.enc`.
  - Derive local PBKDF2 master key exactly as before.
  - Derive tenant key with HKDF-SHA256 and the workspace id as salt.
  - Skip legacy local-key fallback for tenant files so copied flat or foreign
    tenant files do not decrypt.

- [x] **Task 5: Add versioned tenant metadata and audit**
  - Write tenant store `version: 2`.
  - Add `metadata.kdfVersion: 1` and `metadata.workspaceId`.
  - Emit trace-level structured events for tenant read/write/delete/list.

- [x] **Task 6: Validate and close**
  - Run targeted credential tests.
  - Run C4 storage/auth/runtime regressions.
  - Run typecheck, lint, full tests, build, docs validation, agent-contract
    validation, and diff check.
  - Update ticket/worklog to `Status: DONE`.
  - Commit with the Lore protocol.

## Validation Matrix

- `bun test packages/shared/src/credentials/__tests__/tenant-key-derivation.test.ts`
- `bun test packages/shared/src/credentials/__tests__/*`
- `bun test packages/shared/src/config/__tests__/storage-scope-auth.test.ts packages/shared/src/config/__tests__/storage-scope-runtime.test.ts packages/shared/src/config/__tests__/storage-scope.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun test`
- `bun run build`
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `git diff --check`

## Stop Condition

Stop only when T217 has passing validation evidence, a complete 11-section
worklog, a Lore commit, and the roadmap can continue to Phase 1.5 with no
ticket-number collision.
