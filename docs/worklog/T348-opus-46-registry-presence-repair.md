# T348 - Opus 4.6 registry presence repair

Status: DONE
Phase: post-upstream full-suite repair
Ticket: docs/tickets/T348-opus-46-registry-presence-repair.md

## 1. Task summary

Repair the shared model registry contract after current `origin/main` full-suite
validation exposed that Opus 4.6 was missing from `ANTHROPIC_MODELS`.

## 2. Repo context discovered

`packages/shared/tests/models.test.ts` intentionally keeps an
`opus-4.6-sunset` block. The tests allow Opus 4.7 to remain the preferred
default by requiring it to be listed first, but still require Opus 4.6 to be a
known Anthropic model so users can select it as a fallback.

`packages/shared/src/config/models.ts` listed Opus 4.7, Sonnet 4.6, and Haiku
4.5 only. Because `ANTHROPIC_MODELS` is derived from `MODEL_REGISTRY`, Opus 4.6
was absent from selectable Anthropic model definitions.

## 3. Files inspected

- `packages/shared/tests/models.test.ts`
- `packages/shared/src/config/models.ts`
- `packages/shared/src/config/llm-connections.ts`
- `packages/shared/src/config/storage-llm-connections.ts`

## 4. Tests added first

No new test file was needed. The existing Opus 4.6 registry contract test is
the failing regression gate.

## 5. Expected failing test output

`bun test packages/shared/tests/models.test.ts` failed with:

```text
Expected: "Opus"
Received: "Opus 4.6"

Expected to contain: "claude-opus-4-6"
Received: [ "claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5-20251001" ]
```

## 6. Implementation changes

- Added `claude-opus-4-6` to `MODEL_REGISTRY` immediately after Opus 4.7.
- Preserved Opus 4.7 as the first `shortName: 'Opus'` entry, keeping
  `getModelIdByShortName('Opus')` unchanged.
- Left helper fallback logic unchanged.

## 7. Validation commands run

- `bun test` (red)
- `bun test packages/shared/tests/models.test.ts` (red)
- `bun test packages/shared/tests/models.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:docs`
- `bun run validate:roadmap`
- `bun run validate:rebrand && git diff --check`
- Focused C4/rebrand/credential/observability/auth/model bundle
- `bun test`
- `bun run build`

## 8. Passing test output summary

- `bun test packages/shared/tests/models.test.ts`:
  18 pass, 0 fail, 44 expect calls.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0 with 3 existing React hook warnings and 0 errors.
- `bun run validate:docs`: agent-contract, architecture docs, and sync-v2
  design passed; agent contract reported 11 skills, 303 tickets, and 7
  required docs.
- `bun run validate:roadmap`: 46 phases and 110 tickets validated.
- `bun run validate:rebrand && git diff --check`: rebrand validation passed
  and whitespace diff check was clean.
- Focused C4/rebrand/credential/observability/auth/model bundle:
  220 pass, 0 fail, 543 expect calls across 19 files.
- `bun test`: 6190 pass, 13 skip, 0 fail, 1 snapshot, 25152 expect calls.

## 9. Build output summary

`bun run build` exited 0. Electron main, preload, renderer, resources, and
asset stages completed successfully after restoring the Opus 4.6 registry
entry.

## 10. Remaining risks

Opus 4.6 remains intentionally behind Opus 4.7 in `MODEL_REGISTRY`, so default
Opus callers keep resolving to `claude-opus-4-7`.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Model contract test fails before implementation for Opus 4.6 absence | Green | Targeted model test failed with missing `claude-opus-4-6` and shortName fallback |
| Anthropic registry includes Opus 4.7 and Opus 4.6 | Green | Targeted model test passed |
| Default Opus resolution remains Opus 4.7 | Green | `getModelIdByShortName('Opus')` test passed |
| Targeted model contract test passes | Green | 18 pass, 0 fail |
| Full validation matrix passes | Green | typecheck, lint, validators, focused bundle, full test, and build exit 0 |
| Worklog complete | Green | Final validation evidence recorded |
| Commit created | Green | Atomic commit after validation |
