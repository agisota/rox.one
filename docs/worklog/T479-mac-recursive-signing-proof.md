# T479 - Mac recursive signing proof

Status: DONE
Phase: CI validation repair
Ticket: docs/tickets/T479-mac-recursive-signing-proof.md

## 1. Task summary

Close the mac private-release proof gap identified after T478: replace blanket
top-level `codesign --deep` with explicit nested signing and make the live
validator recursively verify the signed app bundle.

## 2. Repo context discovered

PR #217 is mergeable at head `4b9fd262`. CircleCI `secret-scan` is green on
that SHA and CircleCI `validate` is running. The GitHub Actions mac job fails
almost immediately with `log not found`, so the actionable mac package proof is
still the repository validators plus CircleCI/package reruns.

## 3. Files inspected

- `apps/electron/scripts/afterSign.cjs`
- `apps/electron/electron-builder.yml`
- `scripts/validate-mac-private-release-boundary.ts`
- `scripts/validate-mac-arm-build-workflow.ts`
- `scripts/__tests__/validate-mac-boundary-fixtures.test.ts`
- `.github/workflows/mac-arm-build.yml`
- `.circleci/config.yml`
- `scripts/electron-dist-dev-mac-arm64.ts`

## 4. Tests added first

Extended `scripts/__tests__/validate-mac-boundary-fixtures.test.ts` before the
implementation to require:

- `afterSign.cjs` exposes an explicit `collectSignablePaths` nested signing
  plan.
- The hook covers extensionless packaged native binaries such as `claude`,
  `bun`, and `rg`.
- The hook does not contain a top-level blanket `--deep` signing argument.
- The live validator runs
  `codesign --verify --deep --strict --verbose=4` before metadata and
  entitlement checks.

## 5. Expected failing test output

First RED:

```text
9 pass
3 fail
44 expect() calls
```

Failures were the intended missing-proof failures:
`collectSignablePaths` absent, old live `requireNativeBinaryEntries: false`
still present, and recursive `codesign --verify --deep --strict` absent.

Second RED after adding the extensionless-native-binary assertion:

```text
11 pass
1 fail
46 expect() calls
```

The failure was the intended absence of `SIGNABLE_FILE_NAMES`.

## 6. Implementation changes

- Replaced the T478 blanket top-level `codesign --deep` hook with an explicit
  inner-first signing plan in `apps/electron/scripts/afterSign.cjs`.
- The hook now collects nested `.app`, `.framework`, `.xpc`, `.appex`, `.dylib`,
  `.node`, `.so`, `Contents/MacOS/*`, and known extensionless packaged native
  binaries (`bun`, `rg`, `claude`, `codex`, `copilot`), signs those entries
  first, then signs `ROX.ONE.app` last.
- Added live recursive verification to
  `scripts/validate-mac-private-release-boundary.ts` with
  `codesign --verify --deep --strict --verbose=4`.
- Extended `scripts/validate-mac-arm-build-workflow.ts` and the private mac
  validator to require the explicit nested signing plan and reject the old
  blanket `--deep` hook.
- Corrected T478 post-push evidence now that commit `4b9fd262` is actually on
  `origin/chore/r11-t473-post-t470-audit-refresh`.

## 7. Validation commands run

- `bun test scripts/__tests__/validate-mac-boundary-fixtures.test.ts`
- `bun run validate:mac-arm-build-workflow`
- `bun run validate:mac-private-release-boundary`
- `node --check apps/electron/scripts/afterSign.cjs`
- `git diff --check`
- `bun run validate:ci-contract`
- `bun run validate:docs`
- `bun run typecheck`
- `bun run lint`

## 8. Passing test output summary

- Mac boundary fixture test: `12 pass`, `0 fail`, `50 expect() calls`.
- Mac ARM workflow validator:
  `[mac-arm-build-workflow] ok: Mac ARM workflow contract passed`.
- Mac private release boundary validator: non-darwin host skipped live
  codesign/stapler checks and passed static docs/config boundary checks.
- `node --check apps/electron/scripts/afterSign.cjs` passed.
- `git diff --check` passed with no whitespace errors.
- CI contract validation passed.
- Docs validation passed and counted `445 tickets`, `7 required docs`.
- Typecheck passed.
- Lint passed with the existing seven warnings in electron renderer/deep-link
  files; no new lint error was introduced.

## 9. Build output summary

No local mac package build was run on Linux. The live recursive verification is
now wired into the mac boundary validator; CircleCI/macOS remains the live
package proof after push.

## 10. Remaining risks

R.11 remains blocked and not complete. This ticket only improves the private mac
signing proof; it does not authorize destructive R.11 work. CircleCI is green on
the T479 commit; GitHub Actions validate drift is tracked separately by T480 and
the GitHub macOS ARM64 package job still fails before steps on the macOS runner
surface.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED fails because recursive signing/verification proof is absent | PASS | RED failed with `9 pass`, `3 fail`, `44 expect() calls`; extensionless-native RED failed with `11 pass`, `1 fail`, `46 expect() calls` |
| `afterSign` signs nested code inner-first without top-level `--deep` | PASS | Hook now uses `collectSignablePaths`, `SIGNABLE_FILE_NAMES`, nested-first loop, and a final top-level `codesign` without `--deep` |
| Live mac validator requires `codesign --verify --deep --strict` | PASS | Validator now runs `codesign --verify --deep --strict --verbose=4` and fails with `codesign recursive verification failed` on non-zero status |
| Mac boundary tests and validators pass locally | PASS | Fixture test, mac ARM workflow validator, mac private release boundary validator, hook syntax check, CI contract, docs, typecheck, lint, and diff check passed |
| T479 commit is pushed again for fresh CI | PASS | `git push` updated the PR branch to `155e26e3`; CircleCI validate #130, e2e-core #131, mac-arm-build #132, and secret-scan #133 all passed on that SHA |
| No destructive R.11 action is performed | PASS | No destructive R.11 command is recorded for T479 |
