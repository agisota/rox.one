# T500 - Linux GPG keys + secrets setup

Status: DONE
Phase: v1.0.0-rc.2 A1
Ticket: docs/tickets/T500-linux-gpg-secrets-setup.md

## 1. Task summary

Record the Linux release signing key setup and GitHub Actions secret
configuration needed by the RC2 signed Linux release workflow, without
documenting fixed local secret handoff paths.

## 2. Repo context discovered

PR #233 landed `docs/tickets/T500-linux-gpg-secrets-setup.md` without the
matching worklog. PR #244 backfilled a short worklog, but both the ticket and
worklog still documented a fixed local passphrase path. That conflicts with
the repaired RC2 plan from T499, which requires operator-vault handling and no
fixed `/tmp` private key or passphrase artifact.

## 3. Files inspected

- `docs/tickets/T500-linux-gpg-secrets-setup.md`
- `docs/worklog/T500-linux-gpg-secrets-setup.md`
- `docs/worklog/T499-rc2-plan-security-review-repair.md`
- `docs/superpowers/plans/2026-05-15-v1.0.0-rc.2.md`

## 4. Tests added first

No automated code test was added because this is a docs/operations record. The
RED checks were:

```bash
bun run validate:agent-contract
rg -n "%no-protection|/tmp/rox-linux-gpg.asc|/tmp/rox-gpg-passphrase.txt" docs/tickets/T500-linux-gpg-secrets-setup.md docs/worklog/T500-linux-gpg-secrets-setup.md || true
```

## 5. Expected failing test output

Before PR #244, the agent-contract check failed with:

```text
[agent-contract] DONE ticket ids without matching worklogs: T500
```

After PR #244, the safety grep still found the fixed passphrase-path note in
T500 docs.

## 6. Implementation changes

- Kept the T500 worklog in the required 11-section format.
- Replaced the stale fixed passphrase-path wording with the RC2/T499 contract:
  passphrase material remains in the operator vault and GitHub Actions secret
  store only.
- Left the key identifier and expiry note intact because they are operational
  metadata, not secret material.

## 7. Validation commands run

- `bun run validate:agent-contract` (RED before the first T500 backfill)
- `rg -n "%no-protection|/tmp/rox-linux-gpg.asc|/tmp/rox-gpg-passphrase.txt" docs/tickets/T500-linux-gpg-secrets-setup.md docs/worklog/T500-linux-gpg-secrets-setup.md || true`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`
- GitHub Actions `validate` on PR #243 run `25945559029`
- GitHub Actions `Gitleaks secret scan` on PR #243 run `25945559032`
- CircleCI `secret-scan` on PR #243 build `319`

## 8. Passing test output summary

The exact unsafe-marker grep over T500 docs produced no output after the
repair. Local validators passed in the repair branch:

```text
bun run validate:docs
[agent-contract] ok: 11 skills, 467 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated docs/architecture/sync-v2-design.md

bun run validate:rebrand
rebrand validation passed: no forbidden tokens outside the allowlist
```

Hosted validation for PR #243 produced fresh positive evidence:

```text
GitHub Actions validate: success
GitHub Actions Gitleaks secret scan: success
CircleCI secret-scan: success
```

## 9. Build output summary

No build is required for this docs-only contract repair.

## 10. Remaining risks

This repair only corrects the repo record and contract validation. It does not
rotate signing keys or inspect GitHub secret values; hosted secret scanning
remains the hard evidence that no secret material was committed.

The first CircleCI `validate` attempt on PR #243 failed on the known hosted
`transform_data path containment > allows valid descendant paths and writes
output` unit flake documented by T482/T495. GitHub Actions `validate` passed on
the same SHA, and the failing test passed locally in the PR #243 worktree.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| T500 DONE ticket has a matching worklog | PASS | T500 worklog exists in the required format |
| T500 docs no longer name unsafe fixed temp paths | PASS | Exact unsafe-marker grep over T500 docs produced no output after repair |
| Hosted secret scan is green | PASS | GitHub Actions secret scan and CircleCI secret-scan passed on PR #243 |
| Runtime/source files unchanged | PASS | Docs-only T500 repair |
| Build unnecessary | PASS | No runtime/source behavior changed |
