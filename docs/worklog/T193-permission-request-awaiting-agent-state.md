# T193 - PermissionRequest Awaiting-Agent State After Submit

## 1. Task summary

Add `submitted` local state to `PermissionRequest`. Each of the three action handlers (Allow, Always Allow, Deny) sets `submitted=true` before calling `onResponse`. When `submitted` is true, the action buttons are replaced by a confirmation card with a Lucide `Check` icon and `t('workbench.composer.permission.awaiting')`. New i18n key landed in all 8 locale files (en + 7) atomically. `lint:i18n:parity` confirms `7 locales, 1560 keys each`.

## 2. Repo context discovered

- `PermissionRequest` is a single-shot form: once the user responds, no further interaction is expected until the agent surfaces a new permission request. Resetting `submitted` on remount (rather than via an explicit reset prop) is correct for this UX: the component is unmounted when the agent processes the response and mounted fresh on the next request.
- The confirmation card uses existing Tailwind tokens (`text-muted-foreground`, card padding classes) — no new design tokens.
- Lucide `Check` is already used elsewhere in the composer surface; no new dependency.
- i18n key placement: `workbench.composer.permission.awaiting` slots into the `workbench.composer.permission` namespace at alphabetical position after `workbench.composer.permission.always-allow` and before `workbench.composer.permission.deny` (alphabetically "awaiting" < "deny"). Each locale file uses the same key; only the value differs by locale.
- `lint:i18n:parity` validates key count across all locale files. Before this commit the count was `1559 keys`. Adding one key atomically across all files brings it to `1560`.

## 3. Files inspected

- `apps/electron/src/renderer/components/app-shell/input/PermissionRequest.tsx` — full read; confirmed three handlers, existing `onResponse` call pattern, no current submitted state
- `apps/electron/src/renderer/i18n/locales/en.json` — confirmed namespace structure, key count, alphabetical ordering convention
- `apps/electron/src/renderer/i18n/locales/` (directory listing) — confirmed 8 locale files: `en.json`, `ru.json`, `de.json`, `es.json`, `hu.json`, `ja.json`, `pl.json`, `zh-Hans.json`
- `apps/electron/package.json` — confirmed `lint:i18n:parity` script present

## 4. Tests added first

Not applicable. `PermissionRequest` is not currently covered by RTL tests. The `submitted` state is internal; no consumer integration test exists. Visual verification is manual.

## 5. Expected failing test output

Not applicable.

## 6. Implementation changes

**`apps/electron/src/renderer/components/app-shell/input/PermissionRequest.tsx`:**

- Added: `import { useState } from 'react'`.
- Added: `import { Check } from 'lucide-react'`.
- Inside component: `const [submitted, setSubmitted] = useState(false)`.
- All three handlers updated to: `setSubmitted(true); onResponse(...)`.
- Conditional render before the buttons block:
  ```tsx
  if (submitted) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <Check className="h-4 w-4 shrink-0" />
        <span>{t('workbench.composer.permission.awaiting')}</span>
      </div>
    )
  }
  ```

**8 locale files** (`en.json`, `ru.json`, `de.json`, `es.json`, `hu.json`, `ja.json`, `pl.json`, `zh-Hans.json`):

Key added in alphabetical position within `workbench.composer.permission`:

| Locale | Key | Value |
| --- | --- | --- |
| en | `workbench.composer.permission.awaiting` | `"Awaiting agent…"` |
| ru | `workbench.composer.permission.awaiting` | `"Ожидание агента…"` |
| de | `workbench.composer.permission.awaiting` | `"Warte auf Agent…"` |
| es | `workbench.composer.permission.awaiting` | `"Esperando al agente…"` |
| hu | `workbench.composer.permission.awaiting` | `"Várakozás az ügynökre…"` |
| ja | `workbench.composer.permission.awaiting` | `"エージェントを待機中…"` |
| pl | `workbench.composer.permission.awaiting` | `"Oczekiwanie na agenta…"` |
| zh-Hans | `workbench.composer.permission.awaiting` | `"等待代理…"` |

Net change: +6 lines in PermissionRequest.tsx, +1 key in each of 8 locale files.

## 7. Validation commands run

```bash
bun run typecheck:electron
bun run lint:i18n:parity
```

## 8. Passing test output summary

```text
bun run typecheck:electron
PASS

bun run lint:i18n:parity
OK (7 locales, 1560 keys each)
```

## 9. Build output summary

No production bundle size change beyond the added source lines and locale key. The `Check` icon from `lucide-react` is already tree-shaken into the bundle from other usages. No new dependency added.

## 10. Remaining risks

- **`submitted` state resets on remount only.** If the parent keeps `PermissionRequest` mounted while the agent takes an unusually long time to process, the user sees the confirmation card indefinitely. This is the intended UX: it communicates "waiting" rather than giving the impression the response was lost. If a timeout or retry pattern is needed later, the submitted state can be extended with a timeout hook.
- **Translation quality is engineering-authored.** The 7 non-English values were authored by the engineering team without a professional translation review. Terms like `"Várakozás az ügynökre…"` (hu) and `"エージェントを待機中…"` (ja) are technically correct but may not match the product's established voice in those locales. A native-speaker review pass is recommended before GA.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| `submitted` state resets to `false` on remount | PASS | `baff8d6` — `useState(false)` with no external reset; reset occurs on unmount/remount |
| All three handlers set `submitted=true` before `onResponse` | PASS | `baff8d6` — each handler: `setSubmitted(true); onResponse(...)` |
| Confirmation card shown when `submitted=true`: Check + awaiting text | PASS | `baff8d6` — early return with `Check` icon + `t('workbench.composer.permission.awaiting')` |
| Action buttons hidden when `submitted=true` | PASS | `baff8d6` — early return skips the buttons block |
| New i18n key in all 8 locale files | PASS | `baff8d6` — key added to all 8 files in alphabetical position |
| `lint:i18n:parity` passes: `7 locales, 1560 keys each` | PASS | `bun run lint:i18n:parity` — `OK (7 locales, 1560 keys each)` |
| Typecheck passes | PASS | `bun run typecheck:electron` — PASS |
| Commit created | PASS | `baff8d6` — `feat(composer): PermissionRequest awaiting-agent state after submit [T193]` |
