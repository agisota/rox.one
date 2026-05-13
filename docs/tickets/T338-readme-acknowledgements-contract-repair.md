# T338 - README acknowledgements contract repair

Status: DONE

## Context

After rebasing T302/T337 onto `origin/main`, full `bun test` exposed a
deterministic R.4 documentation contract regression from PR #93 and later
canonical-history replays. The current README no longer has a
`## Acknowledgements` section containing the upstream OSS URL, the README no
longer carries the source-checkout CLI smoke snippet, and `snapshot.md` no
longer includes the legal-preserve upstream URL required by
`scripts/__tests__/rebrand-doc-cleanup.test.ts`.

## Goal

Restore the documentation attribution and source-checkout smoke contract
required by the rebrand documentation tests without changing runtime behavior.

## Required UI

None.

## Required Data/API

No runtime API changes.

## Required Automations

None.

## Required Subagents

None. The failing targeted test identifies the exact documentation contract.

## TDD Requirements

Use the existing contract test as the red check:

`bun test scripts/__tests__/rebrand-doc-cleanup.test.ts`

The expected failures are the missing upstream URL inside the README
`Acknowledgements` section, the missing source-checkout `rox-cli` smoke alias,
and the missing upstream attribution URL in `snapshot.md`.

## Implementation Requirements

- Restore a `## Acknowledgements` section in `README.md`.
- Include `https://github.com/lukilabs/rox-agents-oss` in that section.
- Restore the source-checkout `rox-cli` smoke snippet.
- Include the same legal-preserve upstream URL in `snapshot.md`.
- Do not reintroduce legacy clone/setup commands.
- Do not change runtime source.

## Validation Commands

- `bun test scripts/__tests__/rebrand-doc-cleanup.test.ts`
- `bun run validate:docs`
- `bun run validate:roadmap`
- `bun run validate:rebrand`
- `git diff --check`
- `bun test`

## Acceptance Criteria

- [x] README contains `## Acknowledgements` with the upstream URL.
- [x] README contains the source-checkout `rox-cli` smoke snippet.
- [x] `snapshot.md` contains the legal-preserve upstream URL.
- [x] Rebrand doc cleanup contract passes.
- [x] Docs/roadmap/rebrand validators pass.
- [x] Full `bun test` passes.
- [x] No runtime files are changed.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T338-readme-acknowledgements-contract-repair.md`.
