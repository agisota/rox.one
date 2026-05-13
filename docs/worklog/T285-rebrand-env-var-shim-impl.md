# T285 - Rebrand env-var shim implementation

Status: DONE
Phase: R.6
Ticket: docs/tickets/T285-rebrand-env-var-shim-impl.md

## 1. Task summary

Add `packages/shared/src/utils/env-compat.ts` exporting `readEnv(name)` plus
a `__resetEnvCompatWarningsForTests()` helper. The function reads the
canonical `ROX_*` env var when set, falls back to the matching legacy
`ROX_*` value when only the legacy is set (emitting a once-per-process
deprecation warning on stderr), and returns `undefined` when neither is set.

## 2. Repo context discovered

- Phase R.6 of the rebrand-sweep goal doc fully specifies the shim API
  (signature, body, warning text). The validator script
  `scripts/validate-rebrand.cjs:73` already allowlists `env-compat.ts` for
  the `ROX_` token, so the new file does not trip the rebrand gate.
- `packages/shared` is published as `@rox-one/shared` after R.5; its
  `exports` map already lists `./utils` -> `./src/utils/index.ts`.
- The reference pattern for spying on stderr is in
  `packages/shared/src/config/__tests__/storage-scope-auth.test.ts` via
  `spyOn(process.stderr, 'write').mockImplementation(...)`.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md` §"Phase R.6"
- `docs/superpowers/goals/2026-05-13-rox-one-v1-end-to-end-spine-goal.md`
  §"Concurrency rules", §"Global validation matrix",
  §"Mandatory phase pre-check"
- `docs/superpowers/goals/2026-05-13-rox-one-claude-code-ralph-tdd-goal.md`
  §"Cycle protocol"
- `scripts/validate-rebrand.cjs`
- `packages/shared/package.json`
- `packages/shared/src/utils/index.ts`
- `packages/shared/src/config/__tests__/storage-scope-auth.test.ts`

## 4. Tests added first

`packages/shared/src/utils/__tests__/env-compat.test.ts` covers six cases:

1. neither var set -> `undefined`.
2. new var set -> returns new value (no warning).
3. legacy var set only -> returns legacy value + emits one warning.
4. repeated read of same legacy var -> no second warning.
5. two different legacy vars -> two distinct warnings.
6. both vars set -> returns new value (no warning).

The Set of already-warned legacy names is per-process module-level state;
the test calls `__resetEnvCompatWarningsForTests()` between cases so each
test runs against a clean warned-set.

## 5. Expected failing test output

Running before `env-compat.ts` exists:

```
$ bun test packages/shared/src/utils/__tests__/env-compat.test.ts
error: Cannot find module '../env-compat.ts'
```

(verbatim captured during cycle execution; see commit log for details)

## 6. Implementation changes

`packages/shared/src/utils/env-compat.ts` — module-scoped `Set<string>`,
private `emitEnvDeprecationWarning(legacyName, newName)`, public
`readEnv(name)`, public `__resetEnvCompatWarningsForTests()`. No exported
state beyond the two functions. Body matches the goal-doc sketch verbatim.

`packages/shared/src/utils/index.ts` — re-export from `./env-compat.ts`.

## 7. Validation commands run

- `bun test packages/shared/src/utils/__tests__/env-compat.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:rebrand`

## 8. Passing test output summary

- `bun test packages/shared/src/utils/__tests__/env-compat.test.ts`:
  6 pass, 0 fail, 17 expect calls.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0.
- `bun run validate:rebrand`: expected red while later rebrand phases remain;
  1457 findings in the dirty R.6 worktree, with no new finding from
  `packages/shared/src/utils/env-compat.ts`.

## 9. Build output summary

No build needed in T285 (no consumer wiring yet); see T286 worklog.

## 10. Remaining risks

- The shim depends on `console.warn` going to stderr (Node default). Tests
  spy on `process.stderr.write` because Bun's `console.warn` writes through
  that file descriptor.
- Module-level mutable state means tests must reset between cases to avoid
  cross-test leakage; the exported `__reset...` helper covers this.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
|---|---|---|
| `env-compat.ts` exists with two exported functions | Pass | `readEnv` and `__resetEnvCompatWarningsForTests` are implemented in `packages/shared/src/utils/env-compat.ts` |
| All 6 unit tests pass | Pass | Focused test: 6 pass, 0 fail, 17 expect calls |
| Warning fires exactly once per legacy var per process | Pass | `warns exactly once per legacy var per process` test passes |
| Different legacy vars get separate warnings | Pass | `warns separately for each distinct legacy var` test passes |
| Re-exported from utils barrel | Pass | `packages/shared/src/utils/index.ts` exports `./env-compat.ts` |
| No new typecheck or lint failure | Pass | `bun run typecheck` and `bun run lint` exit 0 |
