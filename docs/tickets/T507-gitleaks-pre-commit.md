# T507 - Gitleaks Pre-commit Hook (RC2)

Status: DONE

## Context

CI runs `gitleaks-action` on every PR via `.github/workflows/secret-scan.yml`.
This catches leaks AFTER push, which is too late if a secret enters git history.
The solution is a pre-commit hook that runs `gitleaks protect --staged --redact`,
blocking the commit before secrets enter local history.

The repo uses husky v9.1 (`.husky/pre-push` exists). The new check is added as
a new `.husky/pre-commit` hook following the same shim layout pattern.

## Goal

Add a Gitleaks pre-commit hook that blocks commits containing secrets, failing
open (warn + allow) when gitleaks is not installed locally.

## Changes

- `.husky/pre-commit` — new hook; runs `gitleaks protect --staged --redact --no-banner`
  with a fail-open guard for developers who have not installed gitleaks.
- `.gitleaks.toml` — new allowlist config at repo root for known false positives
  (test fixtures, snapshots, dependency risk register files).
- `scripts/__tests__/gitleaks-pre-commit-smoke.test.ts` — smoke test that
  verifies the pre-commit hook invokes `gitleaks protect` through a fake binary
  and remains fail-open when the local binary is absent.
- `docs/tickets/T507-gitleaks-pre-commit.md` — this ticket.
- `docs/worklog/T507-gitleaks-pre-commit.md` — implementation worklog.

## Validation

```sh
# Syntax check
bash -n .husky/pre-commit

# Smoke test (uses a fake gitleaks binary)
bun test scripts/__tests__/gitleaks-pre-commit-smoke.test.ts
```

## Fail-open Policy

If `gitleaks` is not installed, the local hook emits install instructions and
exits 0, so the commit proceeds. Hosted CI (`secret-scan.yml`) is the hard gate
and is not weakened by broad documentation allowlists.

## Install Instructions

```sh
# macOS
brew install gitleaks

# Linux (Debian/Ubuntu)
apt install gitleaks
# OR: https://github.com/gitleaks/gitleaks#installing
```
