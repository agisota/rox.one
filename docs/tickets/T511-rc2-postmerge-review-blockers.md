# T511 — RC2 post-merge review blocker repair

Status: DONE
Phase: RC2 post-merge stabilization
Owner: agent-executor

---

## Summary

Restore the review-blocker fixes that were prepared for RC2 release-hardening
PRs but were not present on `origin/main` after the stale-head merge queue
landed. This is a consolidation ticket only; each underlying behavioral change
remains documented by its original ticket and worklog.

## Background

The RC2 PR queue merged several stale heads after reviewer fixes had been
prepared in isolated worktrees. The merged main branch retained known blockers
in release workflows, local secret scanning, artifact validation, SBOM upload
gates, Renovate preview mode, and the rate-limit audit document.

## Scope

- Reapply T500 hosted-evidence and unsafe passphrase-doc cleanup.
- Reapply T501/T502 unsigned release workflow guardrails.
- Reapply T503 platform-scoped packaged-artifacts validation.
- Reapply T507 gitleaks hard-gate/local-hook semantics.
- Reapply T508 Linux SBOM stability gate.
- Reapply T509 manual Renovate approval gate.
- Reapply T510 rate-limit audit corrections.

## Acceptance Criteria

- [x] Branch diff contains no unsafe fixed passphrase path guidance.
- [x] Release workflow validators and targeted tests pass locally.
- [x] Gitleaks config no longer blanket-allowlists docs markdown.
- [x] Renovate requires dependency dashboard approval and keeps automerge off.
- [x] T510 audit includes both `server.ts` and `messaging.ts`.
- [x] `bun run validate:agent-contract`, `bun run validate:docs`,
      `bun run validate:rebrand`, `bun run lint`, `bun run typecheck:all`, and
      `git diff --check` pass.
