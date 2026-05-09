# Composer RTL Coverage Notes

Tracking coverage for `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx` (the main composer surface, ~630 LOC).

## Run

```bash
bun run test:rtl:coverage
```

This prints a v8 coverage report covering files matched by the vitest config's
include glob. Look for `FreeFormInput.tsx` in the output.

## Current state (T187 + T188 + T197)

| Metric | FreeFormInput.tsx | Target | Gap |
|---|---|---|---|
| Lines | 44.25% | 70% (aspirational) | model picker dropdown internals (~270 uncovered LOC) |
| Branches | 50.18% | — | — |
| Functions | 28.30% | — | — |

### Change log

| Ticket | Delta (Lines) | Notes |
|---|---|---|
| T187 + T188 | baseline 36.30% | initial RTL suite (send, attachments, mode-switching, thinking-level, slash-mention) |
| T197 | +7.95% → 44.25% | WorkingDirectoryBadge coverage via `freeform-input.working-dir.rtl.test.tsx` |

## Why not 70%

The remaining large uncovered region is:

1. **Model picker dropdown** (~270 LOC): nested Radix `DropdownMenu` submenus,
   vision toggles, hierarchical connection groups. Opening this menu under
   happy-dom is blocked by a multi-copy `@radix-ui/react-context` issue
   (Radix-internal singleton resolves to a different copy than the one the
   tests' mocked `<DropdownMenu>` consumes). T187 mocked the entire dropdown
   surface for 4 of 5 test files and stubbed it for the 5th (thinking-level).

2. **WorkingDirectoryBadge** (~240 LOC) — now partially covered by T197 via
   Popover stub (always-rendered children pattern). The badge trigger, "Choose
   Folder" button, X-remove on recent folders, and a11y are exercised. Remaining
   gap: cmdk filter input path (requires >5 recent dirs) and reset-to-session-root
   path — both are minor and deferred to a follow-up FreeFormInput split.

## Plan to hit 70%

Would require either:
- Resolve the multi-copy Radix context issue (likely needs a Vitest dedupe
  config or a custom Radix wrapper).
- Split FreeFormInput into focused sub-components (`MainComposer`,
  `WorkingDirectoryBadge`, `ModelPicker`) and write per-sub-component RTL
  tests against each.

Both are out of scope for Pillar 2. They land in a follow-up sub-project
once Pillar 3's visual polish is done and the test safety net is in place.

## CI gate

**No CI gate is enforced yet.** Per the user-approved plan, T189 collects
data first; a CI threshold lands in a future sub-project after the
FreeFormInput-split refactor.
