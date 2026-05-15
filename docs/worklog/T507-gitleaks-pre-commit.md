# T507 — Gitleaks pre-commit hook (worklog)

## What was done
Created .husky/pre-commit (mode 755) with gitleaks staged-scan that fail-opens when binary not installed locally. Added .gitleaks.toml allowlist (docs markdown, test fixtures, __snapshots__, dependency risk register files). Added scripts/__tests__/gitleaks-pre-commit-smoke.test.ts — bun:test smoke test running gitleaks detect against temp file with fake AWS key, asserts leak reported.

## Why
CI secret-scan.yml catches leaks AFTER push — too late if secret enters git history. Pre-commit hook blocks BEFORE local history mutation. User CLAUDE.md: "Secret leak scan: run trufflehog/gitleaks before each push." Fail-open required so devs without local gitleaks aren't blocked from commit; CI remains hard gate.

## Verification
- bash -n .husky/pre-commit syntax OK
- Smoke test SKIPPED in current env (no gitleaks binary); CI gate is hard enforcement
