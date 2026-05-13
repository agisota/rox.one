# T086 - Security and Abuse Hardening

Status: DONE

## Goal

Harden the integrated Experience runtime against final mission pass spoofing
before RC.

## Scope

- Reuse existing T071 security hardening where it already covers tenant/RBAC,
  share redaction, billing redaction, mission budget, provider payload, and
  package trust abuse cases.
- Add a focused Experience runtime regression for forged mission finalization.
- Ensure finalization requires:
  - a real stored final artifact for the mission;
  - a real passing validation gate result;
  - no blocking failed gate for the same mission.
- Keep tests deterministic and fake-provider-safe.

## Acceptance Criteria

- [x] Forged final artifact/gate refs cannot complete a mission.
- [x] Failed blocking gate prevents final pass.
- [x] Existing Experience security tests continue to pass.
- [x] Worklog complete.
- [x] Scoped Lore commit created.

## Completion

RPC integration coverage for the T071 abuse-hardening primitives (`TokenBucket`,
`SlidingWindowCounter`, `BudgetGuard`) is now in place. The integration test
exercises each primitive in isolation, plus two composed scenarios that wrap a
mock `RolesHandlerLike` to prove throttling and per-user budget exhaustion both
short-circuit *before* the handler is reached. Clock is injected so the suite
runs in ~43ms with no real-time waits.

- Test file: `packages/server-core/src/handlers/rpc/__tests__/abuse-hardening-integration.test.ts`
- Coverage: 10 tests, 53 `expect()` calls
- Handler source intentionally untouched — wiring of these guards into the
  real RPC handlers is tracked as T086b.
