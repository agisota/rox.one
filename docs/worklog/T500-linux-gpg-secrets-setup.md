# T500 - Linux GPG keys + secrets setup

Status: DONE
Phase: v1.0.0-rc.2 A1
Ticket: docs/tickets/T500-linux-gpg-secrets-setup.md

## 1. Task summary

Record the Linux release signing key setup and GitHub Actions secret
configuration needed by the RC2 signed Linux release workflow.

## 2. Repo context discovered

PR #233 landed `docs/tickets/T500-linux-gpg-secrets-setup.md` without the
matching worklog. That made `validate:agent-contract` fail on `origin/main`.
The ticket also carried a stale fixed `/tmp` passphrase-path note that conflicts
with the repaired RC2 plan from T499.

## 3. Files inspected

- `docs/tickets/T500-linux-gpg-secrets-setup.md`
- `docs/worklog/T499-rc2-plan-security-review-repair.md`
- `docs/superpowers/plans/2026-05-15-v1.0.0-rc.2.md`

## 4. Tests added first

No automated code test was added because this is a docs/operations record. The
RED checks were:

```bash
bun run validate:agent-contract
rg -n "fixed local passphrase path|orchestrator host" docs/tickets/T500-linux-gpg-secrets-setup.md docs/worklog/T500-linux-gpg-secrets-setup.md || true
```

## 5. Expected failing test output

The agent-contract check failed with:

```text
[agent-contract] DONE ticket ids without matching worklogs: T500
```

The safety grep found the stale fixed passphrase-path note in the T500 ticket.

## 6. Implementation changes

- Added this T500 worklog so the DONE ticket has the required matching
  worklog.
- Replaced the stale fixed passphrase-path note with the RC2/T499 contract:
  passphrase material remains in the operator vault and GitHub Actions secret
  store only.
- Left the key identifier and expiry note intact because they are operational
  metadata, not secret material.

## 7. Validation commands run

- `bun run validate:agent-contract` (RED before implementation)
- `rg -n "fixed local passphrase path|orchestrator host" docs/tickets/T500-linux-gpg-secrets-setup.md docs/worklog/T500-linux-gpg-secrets-setup.md || true`
  (RED before implementation)
- `rg -n "%no-protection|/tmp/rox-linux-gpg.asc|/tmp/rox-gpg-passphrase.txt" docs/tickets/T500-linux-gpg-secrets-setup.md docs/worklog/T500-linux-gpg-secrets-setup.md || true`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

Post-edit contract validation passed:

```text
[agent-contract] ok: 11 skills, 467 tickets, 7 required docs
```

`git diff --check` also exited 0.

The exact unsafe-marker grep over T500 docs produced no output. Additional
validators passed:

```text
bun run validate:docs
[agent-contract] ok: 11 skills, 467 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated docs/architecture/sync-v2-design.md

bun run validate:rebrand
rebrand validation passed: no forbidden tokens outside the allowlist
```

## 9. Build output summary

No build is required for this docs-only contract repair.

## 10. Remaining risks

This repair only corrects the repo record and contract validation. It does not
rotate signing keys or inspect GitHub secret values; hosted secret scanning
remains the hard evidence that no secret material was committed.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| T500 DONE ticket has a matching worklog | PASS | `bun run validate:agent-contract` passed |
| T500 ticket no longer names the unsafe fixed temp paths | PASS | Exact unsafe-marker grep over T500 docs produced no output |
| Runtime/source files unchanged | PASS | Docs-only repair |
| Build unnecessary | PASS | No runtime/source behavior changed |
