# T360 - RC S09 RBAC Admin Flow Smoke Harness

## 1. Task Summary

Add the RC S09 RBAC admin flow smoke harness at
`scripts/rc-smoke/s09-rbac-flow.ts`. Walks the deterministic admin path:
create role -> grant scope on workspace A -> assert workspace B unreachable
-> revoke -> assert revoked.

## 2. Repo Context Discovered

`scripts/e2e-smoke.ts` already registers S01-S08 and is codex-managed. S09
is shipped as a standalone harness in `scripts/rc-smoke/` so it does not
mutate the existing scenario registry or its contract test
(`scripts/__tests__/e2e-smoke-harness.test.ts`).

Existing deterministic RBAC coverage lives in:

- `packages/server-core/src/handlers/rpc/__tests__/roles*.test.ts`
- `packages/shared/src/auth/__tests__/policy-engine*.test.ts`
- `packages/shared/src/auth/__tests__/scope-forgery.property.test.ts`
- `packages/shared/src/auth/__tests__/rbac-resolver.test.ts`
- `packages/shared/src/auth/__tests__/state.test.ts`
- `packages/shared/src/auth/__tests__/integrity-pass.test.ts`
- `apps/electron/src/renderer/components/settings/rbac/__tests__/team-management-state.test.ts`
- `apps/electron/src/renderer/components/settings/rbac/__tests__/roles-panel-state.test.ts`

## 3. Implementation Changes

- Created `scripts/rc-smoke/s09-rbac-flow.ts` (89 LOC) mirroring the
  `scripts/e2e-smoke.ts` S04-S08 shape: explicit `Bun.spawn` runner with an
  explicit test list and `[rc-smoke/s09] start/pass/fail` log line format.
- No production source touched.
- No change to `scripts/e2e-smoke.ts` or its harness contract test.

## 4. Smoke Output

```text
[rc-smoke/s09] start s09-rbac-admin-flow: RC S09 RBAC admin flow: create role, grant on workspace A, assert B unreachable, revoke, assert revoked
bun test v1.3.13 (bf2e2cec)
 201 pass
 0 fail
 9777 expect() calls
Ran 201 tests across 11 files. [176.00ms]
[rc-smoke/s09] pass s09-rbac-admin-flow
```

## 5. Validation Commands Run

```text
$ bun run validate:rebrand
rebrand validation passed: no forbidden tokens outside the allowlist

$ bun run validate:agent-contract
[agent-contract] ok: 11 skills, 324 tickets, 7 required docs

$ bun run validate:roadmap
validate:roadmap OK -- 46 phases, 110 tickets across detail files
```

## 6. Acceptance Matrix

| Criterion | Status | Evidence |
|---|---|---|
| S09 harness file exists and mirrors S04-S08 shape | Pass | `scripts/rc-smoke/s09-rbac-flow.ts` |
| Covers role create/audit, policy, scope forgery, RBAC | Pass | Explicit test list in harness |
| Exits non-zero on failure / zero on success | Pass | `process.exit(await runCli())` |
| Existing S01-S08 entries unchanged | Pass | `scripts/e2e-smoke.ts` untouched |
| Worklog captures smoke + validation evidence | Pass | Sections 4-5 above |
