# T474 - Shiki singleton test timeout guard

Status: DONE
Phase: Shiki test harness hardening
Ticket: docs/tickets/T474-shiki-singleton-test-timeout.md

## 1. Task summary

Stabilize the default Bun test gate for the Shiki singleton consumer contracts
by giving those expensive contract files an explicit per-file timeout budget and
keeping their Shiki fixture scoped to the languages/themes under assertion.

## 2. Repo context discovered

`packages/ui/src/components/markdown/__tests__/code-block-singleton.test.ts`
and
`packages/ui/src/components/code-viewer/__tests__/shiki-code-viewer-singleton.test.ts`
both exercise the shared `@rox-one/shared/highlight` singleton with real Shiki
grammar/theme loading. The default Bun per-test timeout is 5 seconds, while the
post-T473 full-suite run timed out in the CodeBlock singleton contract under
suite load even though the assertions completed and passed with an explicit
timeout override.

The highlighter factory accepts `langs` and `themes` options on first singleton
creation, so the consumer contract tests can keep using the real adapter while
loading only the JavaScript/TypeScript grammars and asserted themes. This keeps
the test faithful to the component wiring without paying the full corpus warmup
cost repeatedly.

## 3. Files inspected

- `AGENTS.md`
- `packages/ui/src/components/markdown/__tests__/code-block-singleton.test.ts`
- `packages/ui/src/components/code-viewer/__tests__/shiki-code-viewer-singleton.test.ts`
- `packages/shared/src/highlight/highlighter.ts`
- `packages/shared/src/highlight/singleton.ts`
- `packages/shared/src/highlight/languages.ts`
- `packages/shared/src/highlight/themes.ts`
- `docs/worklog/T447-r11-preflight-backup-branch-collector-regression.md`
- `docs/worklog/T473-r11-post-t470-audit-refresh.md`

## 4. Tests added first

No assertions were added. This is a test-harness hardening change that keeps the
existing Shiki singleton contract assertions intact and adds an explicit timeout
budget to the expensive files.

## 5. Expected failing test output

The default-timeout failure was captured during the post-T473 full-suite run:

```text
2 tests failed:
(fail) CodeBlock singleton wiring > singleton output is deterministic per (code, lang, theme) — CodeBlock LRU contract [74703.33ms]
  ^ this test timed out after 5000ms.
(fail) CodeBlock singleton wiring > resetSingletonHighlighter rebuilds cleanly — HMR / test reload path [33604.28ms]
  ^ this test timed out after 5000ms.

6909 pass
13 skip
2 fail
```

In the T474 worktree, the first targeted run failed before timeout reproduction
because dependencies were not provisioned in the new worktree:

```text
error: Cannot find module '@shikijs/core' from '/tmp/rox-one-terminal-shiki-timeout/packages/shared/src/highlight/highlighter.ts'
```

After linking to the already-provisioned sibling `node_modules`, the targeted
CodeBlock file and the highlight-corpus-plus-CodeBlock sequence passed under
normal local load, confirming the issue is load-sensitive rather than an
assertion failure.

## 6. Implementation changes

- Added `setDefaultTimeout(30_000)` to the CodeBlock singleton contract test.
- Added the same timeout budget to the ShikiCodeViewer singleton contract test,
  which exercises the same shared highlighter startup path.
- Added narrow test-only singleton highlighter options so the CodeBlock contract
  loads JavaScript/TypeScript plus `github-light`/`github-dark`.
- Added narrow test-only singleton highlighter options so the ShikiCodeViewer
  contract loads JavaScript/TypeScript plus `github-light`/`github-dark` and
  `dracula` for the custom-theme assertion.
- Kept reset hooks and production code unchanged.

## 7. Validation commands run

- `bun test packages/ui/src/components/markdown/__tests__/code-block-singleton.test.ts`
- `bun test packages/shared/src/highlight/__tests__/highlight-corpus.test.ts packages/ui/src/components/markdown/__tests__/code-block-singleton.test.ts`
- `bun test packages/ui/src/components/markdown/__tests__/code-block-singleton.test.ts packages/ui/src/components/code-viewer/__tests__/shiki-code-viewer-singleton.test.ts`
- `bun test packages/shared/src/highlight/__tests__/highlight-corpus.test.ts packages/ui/src/components/markdown/__tests__/code-block-singleton.test.ts packages/ui/src/components/code-viewer/__tests__/shiki-code-viewer-singleton.test.ts`
- `git diff --check`
- `bun run validate:docs`
- `bun run typecheck`
- `bun run lint`
- `bun test`
- Post-rebase on `chore/r11-t473-post-t470-audit-refresh`:
  `bun test packages/ui/src/components/code-viewer/__tests__/shiki-code-viewer-singleton.test.ts packages/ui/src/components/markdown/__tests__/code-block-singleton.test.ts apps/electron/src/renderer/components/shiki/__tests__/ShikiCodeEditor.singleton.test.ts packages/shared/src/highlight/__tests__/highlight-corpus.test.ts`
- Post-PR #217 merge rebase on `origin/main`:
  `bun test packages/ui/src/components/code-viewer/__tests__/shiki-code-viewer-singleton.test.ts packages/ui/src/components/markdown/__tests__/code-block-singleton.test.ts apps/electron/src/renderer/components/shiki/__tests__/ShikiCodeEditor.singleton.test.ts packages/shared/src/highlight/__tests__/highlight-corpus.test.ts`
- Post-PR #217 merge rebase on `origin/main`: `bun run validate:docs`
- Post-PR #217 merge rebase on `origin/main`: `bun run typecheck`
- Post-PR #217 merge rebase on `origin/main`: `bun run lint`
- Post-PR #217 merge rebase on `origin/main`: `git diff --check origin/main...HEAD`
- Post-PR #217 merge rebase on `origin/main`: `bun test`
- After CircleCI validate build 149 reported a one-off
  `transform_data path containment` unit failure:
  `bun test ./packages/session-tools-core/src/handlers/transform-data.test.ts`
- After CircleCI validate build 149 reported a one-off
  `transform_data path containment` unit failure:
  `bun test ./packages/session-tools-core/src/handlers/transform-data-spawn-retry.isolated.ts ./packages/session-tools-core/src/handlers/transform-data.test.ts`
- After CircleCI validate build 149 reported a one-off
  `transform_data path containment` unit failure:
  `for i in $(seq 1 50); do bun test ./packages/session-tools-core/src/handlers/transform-data.test.ts >/tmp/t474-transform-stress.log 2>&1 || { echo "failed iteration $i"; cat /tmp/t474-transform-stress.log; exit 1; }; done`
- After CircleCI validate build 149 reported a one-off
  `transform_data path containment` unit failure: `bun run test:units`

## 8. Passing test output summary

`bun test packages/ui/src/components/markdown/__tests__/code-block-singleton.test.ts`
passed before the timeout edit once dependencies were available: 7 pass, 0
fail, 22 assertions. This showed the contract itself was correct.

`bun test packages/shared/src/highlight/__tests__/highlight-corpus.test.ts packages/ui/src/components/markdown/__tests__/code-block-singleton.test.ts`
passed before the timeout edit: 31 pass, 0 fail, 116 assertions. This showed the
nearest Shiki-heavy sequence did not reproduce the full-suite timeout under
normal local load.

`bun test packages/ui/src/components/markdown/__tests__/code-block-singleton.test.ts packages/ui/src/components/code-viewer/__tests__/shiki-code-viewer-singleton.test.ts`
passed after the narrow test fixture change: 15 pass, 0 fail, 49 assertions in
2.60 seconds. The formerly expensive first highlighted assertion completed in
about 1.34 seconds.

`bun test packages/shared/src/highlight/__tests__/highlight-corpus.test.ts packages/ui/src/components/markdown/__tests__/code-block-singleton.test.ts packages/ui/src/components/code-viewer/__tests__/shiki-code-viewer-singleton.test.ts`
passed after the fixture change: 39 pass, 0 fail, 143 assertions in 26.34
seconds.

Default `bun test` passed without any command-line timeout override: 6911 pass,
13 skip, 0 fail, 1 snapshot, 27529 assertions across 566 files in 145.40
seconds.

After rebasing onto the T477 CircleCI repair branch, the stacked Shiki target
set passed with 46 pass, 0 fail, and 158 assertions.

After PR #217 merged to `main`, the branch was retargeted to `main` and rebased
onto `origin/main`. The stacked Shiki target set passed again with 46 pass, 0
fail, and 158 assertions in 27.08 seconds. Docs validation passed with 448
tickets and 7 required docs. `bun run typecheck` passed. `bun run lint` passed
with the existing 7 warnings and 0 errors. `git diff --check
origin/main...HEAD` passed with no whitespace errors.

The full default test suite also passed after the `origin/main` rebase without a
command-line timeout override: 6918 pass, 13 skip, 0 fail, 1 snapshot, 27567
assertions across 566 files in 144.75 seconds.

CircleCI validate build 149 failed once in the unrelated
`transform_data path containment > allows valid descendant paths and writes
output` unit while GitHub validate, GitHub core scenarios, GitHub Gitleaks, and
CircleCI mac/e2e/secret-scan passed. The transform-data target did not reproduce
locally: the direct file passed with 8 pass, 0 fail; the isolated-neighbor
sequence passed with 9 pass, 0 fail; 50 direct-file stress iterations passed;
and the CircleCI-equivalent local `bun run test:units` passed with the regular
suite at 6918 pass, 13 skip, 0 fail plus all discovered `.isolated.ts` files
green.

## 9. Build output summary

No production build was run. This is a test-only harness change. Typecheck,
lint, docs validation, targeted tests, and the default test suite passed.

## 10. Remaining risks

Hosted CI needs a fresh run after the doc-only amend that records the
non-reproducing CircleCI validate build 149 unit failure. GitHub macOS ARM64 may
still fail before job start due to the repository billing/spending-limit
condition; CircleCI mac remains the available mac runtime proof when that
happens.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Shiki singleton contract tests keep their assertions | PASS | Assertions remain active; custom-theme assertion now uses `dracula` |
| Expensive Shiki singleton contract tests have an explicit timeout budget | PASS | `setDefaultTimeout(30_000)` in both singleton contract files |
| Targeted Shiki singleton tests pass | PASS | 15 pass, 0 fail, 49 assertions in 2.60 seconds |
| Default `bun test` passes without a command-line timeout override | PASS | Post-`origin/main` rebase: 6918 pass, 13 skip, 0 fail in 144.75 seconds |
| CircleCI validate unit flake is checked locally before rerun | PASS | Transform-data direct file 8 pass; isolated-neighbor sequence 9 pass; 50 direct stress iterations passed; local `bun run test:units` passed |
