# T298 - Rebrand git history rewrite

Status: BLOCKED

## Context

Phase R.11 is the destructive rebrand history rewrite. It must not start until
every hard prerequisite in
`docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md` is true.

This ticket exists so the R.11 closeout path is established before any future
backup, filter-repo, legal-preserve, or force-push step is attempted.

## Goal

When unblocked, execute the R.11 git history rewrite exactly as specified by
the rebrand-sweep goal and record every command, backup artifact,
legal-preserve diff, validation run, and force-push result.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

Use the report-only R.11 preflight before any destructive step:

```bash
bun run rebrand:r11-preflight
```

After backup artifacts exist and before any `git filter-repo` invocation, run
the explicit pre-rewrite gate:

```bash
ROX_R11_NO_ACTIVE_GOAL=1 bun run rebrand:r11-preflight --stage pre-rewrite
```

That gate must pass `backup-tag-target`, `backup-branch-target`, and
`offline-mirror-target`; those rows prove the backup tag, backup branch, and
offline mirror `main` target match current `main`.

## Required Subagents

None required before unblock. Use review/verifier help only after the
destructive rewrite has concrete artifacts to inspect.

## TDD Requirements

The RED gate is the R.11 preflight itself. Do not proceed while it exits
non-zero.

## Implementation Requirements

- Do not run `git filter-repo` while preflight is red.
- Do not create or push the backup tag or backup branch while preflight is red.
- Do not create the offline mirror while open PR or active-goal blockers remain.
- Do not run `git filter-repo` until `backup-tag-target`,
  `backup-branch-target`, and `offline-mirror-target` all pass against current
  `main`.
- Do not force-push any ref until all backup and legal-preserve checks pass.
- Preserve Apache 2.0 attribution files and Dockerfile source URL exactly.
- Record pre/post commit counts and all validation output in the worklog.

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

- [ ] R.11 preflight is green before backup creation.
- [ ] Backup tag exists on origin.
- [ ] Backup branch exists on origin.
- [ ] Offline mirror exists at `/tmp/rox-one-terminal-backup-2026-05-13.git`.
- [ ] `backup-tag-target`, `backup-branch-target`, and
  `offline-mirror-target` all pass against current `main`.
- [ ] Explicit pre-rewrite remote branch review passes.
- [ ] `git filter-repo` command history is recorded.
- [ ] `bun run rebrand:r11-legal-preserve` passes.
- [ ] Force-push completes with lease.
- [ ] Post-rewrite validation matrix is green.
- [ ] README post-rewrite coordination banner is added if required by the goal.
- [ ] `docs/release/rebrand-mapping-2026-05-13.md` records the R.11 closeout
  commit SHA.
- [ ] `git log -p --all` history scan shows zero forbidden-token matches
  outside the legal-preserve allowlist.
- [ ] Worklog is complete with command evidence.
- [ ] Commit or force-push result is recorded.

## Worklog

Update `docs/worklog/T298-rebrand-git-history-rewrite.md`.
