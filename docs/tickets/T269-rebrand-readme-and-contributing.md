# T269 - Rebrand README and contributing docs

Status: DONE

## Context

Phase R.4 rewrites active ROX-authored documentation while preserving upstream
legal attribution and leaving historical tickets/worklogs immutable.

## Goal

Rewrite the root README and contributor guide so active product-facing prose,
setup instructions, repository paths, and CLI aliases use canonical ROX.ONE
branding.

## Required UI

None.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

No subagent required; the touched documentation files are bounded and can be
verified with a focused regression test plus `rg` review.

## TDD Requirements

Add a focused R.4 documentation regression test before editing the docs and
confirm it fails on the existing legacy README/CONTRIBUTING content.

## Implementation Requirements

- Update `README.md` build-from-source instructions to the ROX.ONE repository.
- Preserve upstream attribution in an allowed acknowledgements section.
- Rewrite root README CLI examples to use a canonical ROX alias instead of a
  legacy product alias.
- Rewrite the root README architecture root to `rox-one-terminal/`.
- Update `CONTRIBUTING.md` clone/setup instructions and package examples to
  canonical ROX.ONE naming.
- Do not edit historical ticket/worklog artifacts.

## Validation Commands

- `bun test scripts/__tests__/rebrand-doc-cleanup.test.ts`
- `bun run validate:docs`
- `git diff --check`
- Phase closeout runs `bun run typecheck`, `bun run lint`, and
  `bun run validate:rebrand` with expected remaining later-phase findings.

## Acceptance Criteria

- [x] Red test proves the README/CONTRIBUTING cleanup gap.
- [x] README setup and CLI examples use ROX.ONE naming.
- [x] README keeps upstream attribution in the acknowledgements boundary.
- [x] CONTRIBUTING setup and package examples use ROX.ONE naming.
- [x] Validation evidence is recorded in the worklog.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T269-rebrand-readme-and-contributing.md`.
