# T193 - PermissionRequest Awaiting-Agent State After Submit

Status: DONE

## Context

`PermissionRequest` presents Allow / Always Allow / Deny action buttons. After the user clicks a button, the component remained in its interactive state with the buttons still visible, giving no feedback that the response was dispatched and the agent is processing. This is a single-shot interaction: once the user responds, the buttons should be replaced with a confirmation that the system received the action.

## Goal

Add a `submitted` local state via `useState`. Each handler (Allow, AlwaysAllow, Deny) sets `submitted=true` before calling `onResponse`. When `submitted` is true, replace the action buttons with a confirmation card containing a Lucide `Check` icon and the i18n string `t('workbench.composer.permission.awaiting')`. Add the new i18n key to all 7 supported locales atomically.

## Required UI

- `submitted` boolean local state, default `false`.
- All three button handlers: `setSubmitted(true)` then `onResponse(...)`.
- When `submitted=true`: render a confirmation card — Lucide `Check` icon + `t('workbench.composer.permission.awaiting')` text — in place of the action buttons.
- Confirmation card uses existing card/muted typography tokens; no new design tokens.

## Required Data/API

New i18n key: `workbench.composer.permission.awaiting` in all 7 locale files:

| Locale | Value |
| --- | --- |
| en | `"Awaiting agent…"` |
| ru | `"Ожидание агента…"` |
| de | `"Warte auf Agent…"` |
| es | `"Esperando al agente…"` |
| hu | `"Várakozás az ügynökre…"` |
| ja | `"エージェントを待機中…"` |
| pl | `"Oczekiwanie na agenta…"` |
| zh-Hans | `"等待代理…"` |

## Required Automations

- `lint:i18n:parity` must pass: `7 locales, 1560 keys each`.

## Required Subagents

None.

## TDD Requirements

Not applicable. The `submitted` state is internal; the component is not currently covered by RTL tests. Visual verification is manual.

## Implementation Requirements

- `apps/electron/src/renderer/components/app-shell/input/PermissionRequest.tsx`:
  - `import { useState } from 'react'`.
  - `import { Check } from 'lucide-react'`.
  - `const [submitted, setSubmitted] = useState(false)`.
  - Each handler: `setSubmitted(true); onResponse(...)`.
  - Conditional render: `if (submitted) return <ConfirmationCard />` (or inline JSX) before the buttons block.
- All 8 locale files in `apps/electron/src/renderer/i18n/locales/`: add the key at the alphabetically correct position in the `workbench.composer.permission` namespace.

## Validation Commands

- `bun run typecheck:electron`
- `bun run lint:i18n:parity`

## Acceptance Criteria

- [x] `submitted` state resets to `false` on component remount (fresh form on navigation).
- [x] All three handlers set `submitted=true` before calling `onResponse`.
- [x] Confirmation card shown when `submitted=true`: Lucide `Check` + awaiting text.
- [x] Action buttons hidden when `submitted=true`.
- [x] New i18n key present in all 8 locale files (en + 7 others).
- [x] `lint:i18n:parity` passes: `7 locales, 1560 keys each`.
- [x] Typecheck passes.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

See `docs/worklog/T193-permission-request-awaiting-agent-state.md`.
