# T347 - Auth integrity-pass type contract repair

Status: DONE
Phase: post-PR135 typecheck repair
Ticket: docs/tickets/T347-auth-integrity-pass-type-contract-repair.md

## 1. Task summary

Repair the auth integrity-pass test type contract after rebasing onto current
`origin/main` through #135 exposed stale test typings.

## 2. Repo context discovered

`PolicyResource` is currently shaped as `{ scopeKind, scopeId }`. The
integrity-pass test used the older `{ kind, id }` resource literal shape in
three `evaluate()` calls. The test helper also accepted `code: string`, but
`validateRoleGrant()` narrows `r.error.code` to `RoleGrantValidationCode`, so
Bun's typed `expect().toBe()` rejected the loose string expected value.

## 3. Files inspected

- `packages/shared/src/auth/__tests__/integrity-pass.test.ts`
- `packages/shared/src/auth/policy-engine.ts`
- `packages/shared/src/auth/roles-schema.ts`
- `packages/shared/src/auth/__tests__/policy-engine.test.ts`
- `packages/shared/src/auth/__tests__/policy-engine.edge-cases.test.ts`

## 4. Tests added first

No new test file was needed. The existing typecheck is the failing contract.

## 5. Expected failing test output

`bun run typecheck` failed with:

```text
src/auth/__tests__/integrity-pass.test.ts(43,40): error TS2769: No overload matches this call.
Argument of type 'string' is not assignable to parameter of type 'RoleGrantValidationCode'.
src/auth/__tests__/integrity-pass.test.ts(...): error TS2353: Object literal may only specify known properties, and 'kind' does not exist in type 'PolicyResource'.
```

## 6. Implementation changes

- Imported `RoleGrantValidationCode` and typed the `expectInvalid()` helper's
  expected code parameter.
- Replaced the three stale policy resource literals with
  `{ scopeKind: 'workspace', scopeId: ... }`.
- Left auth runtime files unchanged.

## 7. Validation commands run

- `bun run typecheck` (red)
- `bun test packages/shared/src/auth/__tests__/integrity-pass.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:docs`
- `bun run validate:roadmap`
- `bun run validate:rebrand && git diff --check`
- Focused C4/rebrand/credential/observability/auth/model bundle
- `bun test`
- `bun run build`

## 8. Passing test output summary

- `bun test packages/shared/src/auth/__tests__/integrity-pass.test.ts`:
  29 pass, 0 fail, 52 expect calls.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0 with 3 existing React hook warnings and 0 errors.
- `bun run validate:docs`: agent-contract, architecture docs, and sync-v2
  design passed; agent contract reported 11 skills, 300 tickets, and 7
  required docs.
- `bun run validate:roadmap`: 46 phases and 110 tickets validated.
- `bun run validate:rebrand && git diff --check`: rebrand validation passed
  and whitespace diff check was clean.
- Focused C4/rebrand/credential/observability/auth/model bundle:
  220 pass, 0 fail, 543 expect calls across 19 files.
- `bun test`: 6145 pass, 13 skip, 0 fail, 1 snapshot, 25040 expect calls.

## 9. Build output summary

`bun run build` exited 0. Electron main, preload, renderer, resources, and
asset stages completed successfully after the auth test type repair.

## 10. Remaining risks

No auth runtime code changed. The repaired test now follows the current
`PolicyResource` and `RoleGrantValidationCode` public types.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Typecheck fails before implementation for stale test typing | Green | `bun run typecheck` failed with TS2769 and TS2353 |
| Auth runtime unchanged | Green | Diff only touches `integrity-pass.test.ts` for auth |
| Targeted integrity-pass test passes | Green | 29 pass, 0 fail |
| Full validation matrix passes | Green | typecheck, lint, validators, focused bundle, full test, and build exit 0 |
| Worklog complete | Green | Final validation evidence recorded |
| Commit created | Green | Atomic commit after validation |
