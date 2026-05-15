# T499 - RC2 plan security review repair

Status: DONE

## Context

PR #232 adds the v1.0.0-rc.2 design and implementation plan. Review found that
the draft A1 Linux GPG prompt could leave unprotected key material or a
plaintext passphrase in `/tmp`, and that the D1 gitleaks hook objective
overstated a fail-open local hook as a hard blocker.

## Goal

Repair the RC2 plan before merge so future execution agents receive safe,
internally consistent instructions.

## Required UI

None.

## Required Data/API

No runtime data or public API changes.

## Required Automations

None.

## Required Subagents

Use read-only code-review help for the PR #232 plan review. Durable evidence
must come from local diff and validation commands.

## TDD Requirements

- Confirm RED before editing: this ticket/worklog pair is absent.
- Confirm the plan contains the unsafe GPG markers `%no-protection`,
  `/tmp/rox-linux-gpg.asc`, and `/tmp/rox-gpg-passphrase.txt`.
- Confirm the plan contains the contradictory gitleaks fail-open hard-block
  wording.

## Implementation Requirements

- Keep the repair docs-only.
- Do not change workflows, scripts, production source, refs, tags, backup
  artifacts, mirrors, or history.
- Replace the GPG runbook with passphrase-protected key generation using
  private temp dirs and cleanup traps.
- Align the gitleaks local hook claim with fail-open behavior.
- Record that RC2 intentionally preempts R.11 and requires a post-merge R.11
  report-only refresh.

## Validation Commands

- `test ! -f docs/tickets/T499-rc2-plan-security-review-repair.md`
- `test ! -f docs/worklog/T499-rc2-plan-security-review-repair.md`
- `rg -n "%no-protection|/tmp/rox-linux-gpg.asc|/tmp/rox-gpg-passphrase.txt" docs/superpowers/plans/2026-05-15-v1.0.0-rc.2.md`
  (expected RED before implementation)
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] RED checks prove the ticket/worklog were absent and unsafe GPG markers
  existed before repair.
- [x] GPG key generation instructions avoid `%no-protection` and persistent
  `/tmp` key/passphrase files.
- [x] Gitleaks local hook language is consistent with fail-open behavior.
- [x] RC2/R.11 ordering is explicit.
- [x] Validators pass.
- [x] No runtime, workflow, ref, or history mutation is performed.

## Worklog

See `docs/worklog/T499-rc2-plan-security-review-repair.md`.
