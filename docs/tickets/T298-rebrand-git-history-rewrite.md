# T298 - Rebrand git history rewrite

Status: DONE

## Context

Phase R.11 is the destructive rebrand history rewrite. It ran after every hard
prerequisite in `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
was satisfied or explicitly acknowledged for the destructive window.

## Goal

Execute the R.11 git history rewrite exactly as specified by the rebrand-sweep
goal and record every command, backup artifact, legal-preserve diff,
validation run, and ref-push result.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

The report-only R.11 preflight was used before destructive steps:

```bash
bun run rebrand:r11-preflight
```

After backup artifacts existed and before `git filter-repo`, the explicit
pre-rewrite gate was run:

```bash
ROX_R11_NO_ACTIVE_GOAL=1 bun run rebrand:r11-preflight --stage pre-rewrite
```

That gate passed `backup-tag-target`, `backup-branch-target`, and
`offline-mirror-target`; those rows prove the backup tag, backup branch, and
offline mirror `main` target matched current `main`.

## Required Subagents

Explore/verifier help was used for post-rewrite placeholder and closeout
coverage review.

## TDD Requirements

The RED gate was the post-rewrite test update that required the mapping report
and T298 worklog to leave the blocked placeholder state. It failed before the
closeout documents were updated.

## Implementation Requirements

- `git filter-repo` ran only after preflight and backup-target rows passed.
- Backup tag, backup branch, and offline mirror were created before filtering.
- The explicit pre-rewrite remote branch review passed after stale origin heads
  were retired.
- Apache 2.0 attribution files and Dockerfile source URL were preserved.
- Pre/post commit counts and validation output are recorded in the worklog.

## Validation Commands

- `bun run rebrand:r11-preflight`
- `bun run rebrand:r11-legal-preserve`
- `bun run validate:rebrand`
- `bun run typecheck`
- `bun test`
- `bun run lint`
- `bun run build`
- `git log --oneline | wc -l`
- `bun run rebrand:r11-history-scan`

## Acceptance Criteria

- [x] R.11 preflight is green before backup creation.
- [x] Backup tag exists on origin.
- [x] Backup branch exists on origin.
- [x] Offline mirror exists at `/tmp/rox-one-terminal-backup-2026-05-13.git`.
- [x] `backup-tag-target`, `backup-branch-target`, and
  `offline-mirror-target` all pass against current `main`.
- [x] Explicit pre-rewrite remote branch review passes.
- [x] `git filter-repo` command history is recorded.
- [x] `bun run rebrand:r11-legal-preserve` passes.
- [x] Force-push completes with lease.
- [x] Post-rewrite validation matrix is green.
- [x] README post-rewrite coordination banner is added if required by the goal.
- [x] `docs/release/rebrand-mapping-2026-05-13.md` records the R.11 closeout
  commit SHA.
- [x] `git log -p --all` history scan shows zero forbidden-token matches
  outside the legal-preserve allowlist.
- [x] Worklog is complete with command evidence.
- [x] Commit or force-push result is recorded.

## Worklog

Update `docs/worklog/T298-rebrand-git-history-rewrite.md`.
