# T199 - B4 Dialog A11y Audit: Radix DialogTitle + DialogDescription Wiring

Status: DONE

## Context

We are building a white-label fork of Rox Agents OSS into Agent Workbench Suite.

PR-B1's architect (Opus) flagged that the focus-trap/ARIA audit for `PromptRewriteDialog` and
`ThinkingPartnerRoundTableDialog` was called out in the plan's "reused utilities" section but not
executed in any T180–T185 worklog. Pillar 1's verification rubric (AGENTS.md) requires confirming
that Radix `<DialogTitle>` and `<DialogDescription>` are wired in every modal.

## Goal

Audit both composer dialogs and confirm or add `<DialogTitle>` + `<DialogDescription>` so
assistive tech always has an accessible name and description for every dialog.

## Required UI

No visible change expected. If titles/descriptions are missing they should be added via
`<VisuallyHidden>` to preserve the current visual design.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

None — scope is two files and seven locale JSON files.

## TDD Requirements

No new tests needed: Radix's own Dialog primitive asserts the contract at runtime via console
warnings. Static audit + i18n parity check is sufficient.

## Implementation Requirements

Inspect both files. Add `<DialogTitle>` and `<DialogDescription>` where missing.
Thread i18n keys through all seven locale files if new keys are needed.

## Validation Commands

- `bun run lint:i18n:parity`
- `bun run lint:i18n:sorted`
- `bun run typecheck:electron`

## Acceptance Criteria

- [x] `PromptRewriteDialog` has `<DialogTitle>` wired (visible or visually-hidden)
- [x] `PromptRewriteDialog` has `<DialogDescription>` wired (visible or visually-hidden)
- [x] `ThinkingPartnerRoundTableDialog` has `<DialogTitle>` wired (visible or visually-hidden)
- [x] `ThinkingPartnerRoundTableDialog` has `<DialogDescription>` wired (visible or visually-hidden)
- [x] All seven locale files contain the relevant i18n keys
- [x] i18n parity and sorted lint pass
- [x] typecheck passes
- [x] Worklog complete
- [x] Architect concern closed

## Worklog

See `docs/worklog/T199-b4-dialog-a11y-audit.md`.
