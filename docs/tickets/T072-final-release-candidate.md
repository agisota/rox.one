# T072 - Final Release Candidate

Status: DONE

## Goal

Prove that the ROX ONE Agent Workbench e2e integration wave is ready for a
release-candidate handoff after T066-T071.

This ticket does not add new runtime features. It closes the integration wave by
documenting the product state, validating the complete fake-provider-safe RC
surface, and listing remaining production blockers.

## Scope

- Create the final release-candidate report.
- Create known limitations.
- Create MVP user guide.
- Create admin/operator guide.
- Run final validation gates.
- Record command evidence in the T072 worklog.
- Commit only T072 release/ticket/worklog files.

## Required RC Scenarios

1. Register -> pending verification state -> sign-in -> account persists after restart.
2. Raw prompt -> Rewrite -> Spec -> TDD -> Review.
3. Create 24h mission -> checkpoint -> final verification.
4. Arena swarm -> dedupe signals -> review board -> VDI update.
5. Team invite -> shared workspace -> RBAC check.
6. File upload -> entity graph -> source link.
7. Sync push/pull -> conflict -> explicit resolution.
8. Share session -> public shortlink provider flow.
9. Upstream v0.9.1 base behavior still passes ROX custom flows.
10. Mac ARM/Electron build opens and smoke passes.

## Required Validation

Run and record:

```bash
bun run validate:docs
bun run validate:agent-contract
bun run typecheck:all
bun test
bun run lint
bun run electron:build
git diff --check
```

Run if available:

```bash
bun run validate:ci
bun run e2e:core
bun run validate:e2e-core-scenarios
bun run electron:smoke
```

## Acceptance Criteria

- [x] Final RC report exists.
- [x] Known limitations exist.
- [x] MVP user guide exists.
- [x] Admin guide exists.
- [x] RC scenario matrix is documented.
- [x] Final validation commands are recorded.
- [x] Worklog is complete.
- [x] Scoped commit exists.
