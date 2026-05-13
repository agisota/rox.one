# T266 - Rebrand test file renames

## 1. Task summary

Renamed the remaining active R.2 test filenames that carried legacy product
tokens while preserving the test assertions and compatibility strings they
cover.

## 2. Repo context discovered

Explorer mapping identified two active test files in this ticket's scope:
`permissions-rox-agent-sync.test.ts` and
`permissions-config-rox-cli-flag.test.ts`. No snapshot or fixture files were
referenced by these tests.

## 3. Files inspected

- `packages/shared/tests/permissions-rox-agent-sync.test.ts`
- `packages/shared/src/agent/__tests__/permissions-config-rox-cli-flag.test.ts`
- `scripts/__tests__/rebrand-code-identifiers.test.ts`

## 4. Tests added first

Extended `scripts/__tests__/rebrand-code-identifiers.test.ts` with a filename
invariant that requires:

- `packages/shared/tests/permissions-agent-sync.test.ts`;
- `packages/shared/src/agent/__tests__/permissions-config-cli-flag.test.ts`;
- absence of the two legacy test filenames.

## 5. Expected failing test output

`bun test scripts/__tests__/rebrand-code-identifiers.test.ts` failed before the
rename because the two legacy filenames still existed:

```text
error: legacy test file names should be renamed

- []
+ [
+   "packages/shared/tests/permissions-rox-agent-sync.test.ts",
+   "packages/shared/src/agent/__tests__/permissions-config-rox-cli-flag.test.ts",
+ ]
```

## 6. Implementation changes

- Renamed `packages/shared/tests/permissions-rox-agent-sync.test.ts` to
  `packages/shared/tests/permissions-agent-sync.test.ts`.
- Renamed
  `packages/shared/src/agent/__tests__/permissions-config-rox-cli-flag.test.ts`
  to `packages/shared/src/agent/__tests__/permissions-config-cli-flag.test.ts`.
- Left `rox-agent` command strings and `ROX_FEATURE_ROX_AGENTS_CLI`
  environment variable assertions intact; those are compatibility surfaces for
  later phases, not filename identifiers for R.2.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-code-identifiers.test.ts`
- `bun test packages/shared/tests/permissions-agent-sync.test.ts`
- `bun test packages/shared/src/agent/__tests__/permissions-config-cli-flag.test.ts`
- `git diff --check`
- `bun run typecheck`
- `bun run lint`

## 8. Passing test output summary

- Rebrand regression: 3 pass, 0 fail, 10 expect calls.
- Permissions sync at new path: 1 pass, 0 fail, 1 expect call.
- Permissions config CLI flag at new path: 2 pass, 0 fail, 4 expect calls.
- Diff check: exit 0.
- Typecheck: exit 0.
- Lint: exit 0.

## 9. Build output summary

Not run for this individual ticket. R.2 final validation will run full
`bun test` and `bun run build`.

## 10. Remaining risks

The renamed tests still contain `rox-agent` command strings and
`ROX_FEATURE_ROX_AGENTS_CLI` because later R.2/R.6 phases own those runtime
compatibility names.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Red test proves active test filename gap | Green | Rebrand regression failed on both legacy filenames before implementation |
| Test files/snapshots use canonical names | Green | Both active test files renamed; no snapshots/fixtures were referenced |
| Renamed tests pass at new paths | Green | Both renamed test commands passed |
| Validation evidence recorded | Green | Targeted tests, typecheck, lint, and diff check recorded above |
| Worklog complete | Green | This 11-section worklog is complete |
| Commit created | Green | Included in this ticket commit |
