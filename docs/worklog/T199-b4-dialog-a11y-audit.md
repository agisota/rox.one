# T199 - B4 Dialog A11y Audit: Radix DialogTitle + DialogDescription Wiring

## 1. Task summary

Perform the Radix Dialog ARIA audit deferred from PR-B1's Pillar 1 verification. Confirm that
`PromptRewriteDialog` and `ThinkingPartnerRoundTableDialog` each expose `<DialogTitle>` and
`<DialogDescription>` so assistive tech has an accessible name and description for every dialog.

## 2. Repo context discovered

- `apps/electron/src/renderer/components/app-shell/input/PromptRewriteDialog.tsx` — created in
  commit `f9d6c65` ("Make prompt rewrite executable from the composer") with `DialogTitle` and
  `DialogDescription` already wired from day one.
- `apps/electron/src/renderer/components/app-shell/input/ThinkingPartnerRoundTableDialog.tsx` —
  created in commit `c737bba` ("Make Thinking Partner produce selectable round-table output") with
  `DialogTitle` and `DialogDescription` already wired from day one.
- i18n keys `workbench.rewrite.dialog.title`, `workbench.rewrite.dialog.description`,
  `workbench.thinking.dialog.title`, `workbench.thinking.dialog.description` are present in all 7
  locale files (en, de, es, hu, ja, pl, ru, zh-Hans).
- The Radix UI dialog component (`apps/electron/src/renderer/components/ui/dialog.tsx`) re-exports
  `DialogTitle` and `DialogDescription` from `@radix-ui/react-dialog`.

## 3. Files inspected

- `apps/electron/src/renderer/components/app-shell/input/PromptRewriteDialog.tsx`
- `apps/electron/src/renderer/components/app-shell/input/ThinkingPartnerRoundTableDialog.tsx`
- `packages/shared/src/i18n/locales/en.json` (sampled; all 7 confirmed via grep)
- `apps/electron/src/renderer/components/ui/dialog.tsx`

## 4. Tests added first

No new tests added. The audit is static verification — Radix's runtime console warning is the
canary for missing titles, and the i18n parity lint gate confirms all locale files are in sync.

## 5. Expected failing test output

N/A — both dialogs were already compliant before this audit task started.

## 6. Implementation changes

**None required.** Both dialogs were already fully compliant:

### PromptRewriteDialog.tsx (lines 53-56)

```tsx
<DialogHeader>
  <DialogTitle>{t('workbench.rewrite.dialog.title')}</DialogTitle>
  <DialogDescription>{t('workbench.rewrite.dialog.description')}</DialogDescription>
</DialogHeader>
```

Accessible name: "Rewrite Prompt" (en). Description: "Review the improved prompt before replacing
the composer text or sending it to Spec Builder." (en). Both visible.

### ThinkingPartnerRoundTableDialog.tsx (lines 67-70)

```tsx
<DialogHeader>
  <DialogTitle>{t('workbench.thinking.dialog.title')}</DialogTitle>
  <DialogDescription>{t('workbench.thinking.dialog.description')}</DialogDescription>
</DialogHeader>
```

Accessible name: "Think With Me" (en). Description: "Use a structured round table to frame
assumptions, hypotheses, questions, and options before execution." (en). Both visible.

## 7. Validation commands run

```text
bun run lint:i18n:parity
bun run lint:i18n:sorted
cd apps/electron && bun run typecheck
```

## 8. Passing test output summary

```text
bun run lint:i18n:parity
i18n parity OK (7 locales, 1556 keys each)

bun run lint:i18n:sorted
(exit 0 — all locale files sorted)

cd apps/electron && bun run typecheck
(exit 0 — tsc --noEmit, no errors)
```

## 9. Build output summary

No source changes were made so a build rerun is not required. Prior build evidence from the
`chore/b4-cleanup` branch head commit covers the same source state.

## 10. Remaining risks

None. Both dialogs have visible `DialogTitle` and `DialogDescription` backed by i18n keys present
in all 7 locale files. The architect's flagged gap is fully resolved — the audit did not defer any
remediation work.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| `PromptRewriteDialog` has `<DialogTitle>` wired | Pass | Line 54, `workbench.rewrite.dialog.title`, en: "Rewrite Prompt" |
| `PromptRewriteDialog` has `<DialogDescription>` wired | Pass | Line 55, `workbench.rewrite.dialog.description`, en: "Review the improved prompt…" |
| `ThinkingPartnerRoundTableDialog` has `<DialogTitle>` wired | Pass | Line 68, `workbench.thinking.dialog.title`, en: "Think With Me" |
| `ThinkingPartnerRoundTableDialog` has `<DialogDescription>` wired | Pass | Line 69, `workbench.thinking.dialog.description`, en: "Use a structured round table…" |
| All 7 locale files contain relevant i18n keys | Pass | grep confirms all 4 keys in all 7 locales |
| i18n parity lint passes | Pass | `i18n parity OK (7 locales, 1556 keys each)` |
| i18n sorted lint passes | Pass | exit 0 |
| typecheck passes | Pass | `tsc --noEmit` exit 0 |
| Worklog complete | Pass | This document |
| Architect concern closed | Pass | Both dialogs compliant since initial creation; no gap exists |
