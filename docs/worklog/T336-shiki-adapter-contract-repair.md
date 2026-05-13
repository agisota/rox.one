# T336 - Shiki Adapter Contract Repair

## 1. Task summary

Repair the already-merged M.11 Shiki adapter slice by adding missing
implementation metadata and fixing the corpus test typecheck failure. Runtime
adapter behavior remains unchanged.

## 2. Repo context discovered

- `origin/main` contains PR #85's adapter commit and PR #86's RBAC property
  tests.
- PR #85 did not include ADR 0010, a Shiki implementation ticket, or a Shiki
  worklog.
- PR #86 already owns ticket T243, so this repair cannot use the roadmap's
  original T243 placeholder without creating duplicate ticket files.
- `packages/shared/src/highlight/__tests__/highlight-corpus.test.ts` indexes
  `HIGHLIGHT_CORPUS[0]` without a non-null assertion.

## 3. Files inspected

- `packages/shared/src/highlight/__tests__/highlight-corpus.test.ts`
- `packages/shared/src/highlight/highlighter.ts`
- `packages/shared/src/highlight/languages.ts`
- `packages/shared/src/highlight/themes.ts`
- `packages/shared/package.json`
- `docs/tickets/T243-rbac-property-based-scope-forgery-tests.md`
- `docs/worklog/T243-rbac-property-based-scope-forgery-tests.md`
- `docs/decision-records/audit-harness/0010-shiki-highlighter.md`

## 4. Tests added first

No new runtime test was added; PR #85 already added the corpus contract test.
This repair begins by running full typecheck to prove the strict-indexing
failure, then fixes that test.

## 5. Expected failing test output

```text
src/highlight/__tests__/highlight-corpus.test.ts(65,34): error TS18048:
'sample' is possibly 'undefined'.
src/highlight/__tests__/highlight-corpus.test.ts(65,47): error TS18048:
'sample' is possibly 'undefined'.
```

## 6. Implementation changes

- Added `docs/tickets/T336-shiki-adapter-contract-repair.md`.
- Added this worklog.
- Updated `packages/shared/src/highlight/__tests__/highlight-corpus.test.ts`
  to use `const sample = HIGHLIGHT_CORPUS[0]!`.
- Left runtime adapter files unchanged.

## 7. Validation commands run

- `bun test packages/shared/src/highlight/__tests__/`
- `bun run validate:docs`
- `bun run validate:roadmap`
- `bun run validate:rebrand`
- `bun run typecheck`
- `bun run lint`
- `bun run build`
- `git diff --check`

## 8. Passing test output summary

```text
bun test packages/shared/src/highlight/__tests__/
24 pass, 0 fail, 94 expect() calls

bun run validate:docs
[agent-contract] ok

bun run validate:roadmap
validate:roadmap OK

bun run validate:rebrand
rebrand validation passed

bun run typecheck
exit 0

bun run lint
exit 0

git diff --check
clean
```

## 9. Build output summary

```text
bun run build
electron main/preload/renderer/resources/assets build completed successfully.
Known Vite warning only: some chunks are larger than 500 kB after minification.
```

## 10. Remaining risks

- This repair does not migrate renderer/UI call sites to the adapter, so the
  bundle-size benefit remains deferred.
- The Shiki corpus test intentionally creates many highlighter instances and
  still emits the Shiki singleton warning. Production usage should use the
  singleton export.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| T336 ticket/worklog exist | PASS | `docs/tickets/T336-*`, `docs/worklog/T336-*` |
| Corpus typecheck failure fixed | PASS | `bun run typecheck` |
| Highlight tests pass | PASS | 24/24 pass |
| Docs validators pass | PASS | `validate:docs`, `validate:roadmap`, `validate:rebrand` |
| Lint/build/diff checks pass | PASS | Section 8 and 9 |
| Runtime adapter unchanged | PASS | Diff touches test/docs/ADR register only |
