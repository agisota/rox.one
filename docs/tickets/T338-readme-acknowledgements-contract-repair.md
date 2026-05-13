# T338 - README acknowledgements contract repair

Status: DONE

## Context

After rebasing T302/T337 onto `origin/main`, full `bun test` exposed a
deterministic README contract regression from PR #93. The current README no
longer has a `## Acknowledgements` section containing the upstream OSS URL,
while `scripts/__tests__/rebrand-doc-cleanup.test.ts` still requires that
legal-preserve attribution.

## Goal

Restore the README acknowledgement required by the rebrand documentation
contract without changing runtime behavior.

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

The expected failure is the missing upstream URL inside the README
`Acknowledgements` section.

## Implementation Requirements

- Restore a `## Acknowledgements` section in `README.md`.
- Include `https://github.com/lukilabs/rox-agents-oss` in that section.
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
- [x] Rebrand doc cleanup contract passes.
- [x] Docs/roadmap/rebrand validators pass.
- [ ] Full `bun test` passes.
- [x] No runtime files are changed.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T338-readme-acknowledgements-contract-repair.md`.
