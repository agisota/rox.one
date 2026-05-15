# T507 - Gitleaks pre-commit hook

Status: DONE
Phase: D1 local hook hardening
Ticket: docs/tickets/T507-gitleaks-pre-commit.md

## 1. Task summary

Patch the gitleaks pre-commit slice so local developer machines are
best-effort and fail open only when the binary is missing, while hosted
`secret-scan.yml` remains the hard gate.

## 2. Repo context discovered

The merged branch added `.husky/pre-commit`, `.gitleaks.toml`, and a smoke
test. Review blockers remained: `.gitleaks.toml` allowlisted every docs
markdown file, the smoke test could pass without a real `gitleaks` binary
because shell error text matched the broad leak regex, and the ticket needed a
complete worklog.

## 3. Files inspected

- `.gitleaks.toml`
- `.husky/pre-commit`
- `scripts/__tests__/gitleaks-pre-commit-smoke.test.ts`
- `docs/tickets/T507-gitleaks-pre-commit.md`
- `docs/worklog/README.md`
- `scripts/validate-agent-contract.ts`

## 4. Tests added first

Before implementation, the existing targeted test was run with a `PATH` that
did not expose a real `gitleaks` binary:

```bash
env PATH="/home/dev/.bun/bin:/usr/bin:/bin" sh -c 'command -v gitleaks || true; bun test scripts/__tests__/gitleaks-pre-commit-smoke.test.ts'
```

It still passed, proving the old smoke test was a false green and did not lock
the intended no-real-gitleaks validation behavior.

## 5. Expected failing test output

The RED signal was the unexpected false pass:

```text
scripts/__tests__/gitleaks-pre-commit-smoke.test.ts:
(pass) gitleaks protect blocks staged fake AWS key
```

The command did not find `gitleaks`, but the test still passed.

## 6. Implementation changes

- Removed the blanket `docs/.*\.md` allowlist from `.gitleaks.toml`.
- Kept only targeted allowlist paths for test fixtures, snapshots, and the
  dependency risk register.
- Clarified `.husky/pre-commit` comments: local hook is best-effort/fail-open
  only when `gitleaks` is missing; hosted CI secret scan remains the hard gate.
- Replaced the smoke test with hook-level tests that inject a fake `gitleaks`
  binary, assert the exact `protect --staged --redact --no-banner` invocation,
  and assert missing local `gitleaks` exits 0 with the skip warning.
- Updated the ticket validation instructions to remove the real-gitleaks test
  prerequisite and kept this worklog in the required 11-section format.

## 7. Validation commands run

- `bun test scripts/__tests__/gitleaks-pre-commit-smoke.test.ts`
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `git diff --check`

## 8. Passing test output summary

Targeted smoke test after the patch:

```text
2 pass
0 fail
2 expect() calls
```

Agent contract validation after the worklog was added:

```text
[agent-contract] ok
```

Docs validation includes agent contract, architecture docs, and sync-v2 design
checks.

## 9. Build output summary

No application build is required for this hook, gitleaks config, and docs-only
patch. The relevant behavior is covered by the targeted Bun smoke test and docs
validators.

## 10. Remaining risks

The local hook intentionally does not block developers who have not installed
`gitleaks`. That is the D1 fail-open behavior; hosted CI secret scanning remains
the hard gate.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Blanket docs markdown allowlist removed | PASS | `.gitleaks.toml` no longer contains `docs/.*\.md`. |
| Local hook remains fail-open only when `gitleaks` is missing | PASS | Smoke test covers missing binary warning and exit 0. |
| Hook calls `gitleaks protect` for staged changes when available | PASS | Fake binary captures `protect --staged --redact --no-banner`. |
| Hosted scan remains hard gate | PASS | Hook comments and ticket preserve `secret-scan.yml` hard-gate semantics. |
| Required T507 worklog exists | PASS | This worklog matches the DONE ticket. |
