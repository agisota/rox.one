# T534 - Session monitor list and Kanban views

## 1. Task summary
Add a persistent session monitor view switch so operators can monitor sessions
either through the existing grouped list or through status-based Kanban columns.

## 2. Repo context discovered
- Existing session list behavior lives in
  `apps/electron/src/renderer/components/app-shell/SessionList.tsx`.
- Session rows already expose pin, inline rename, quick labels, status menus,
  unread badges, and context menus through `SessionItem.tsx`.
- The list data pipeline already filters hidden/archived sessions, applies
  search/filter state, sorts pinned sessions first, paginates, and groups by
  date/status/unread in `useSessionSearch.ts` and `SessionList.tsx`.
- Existing local renderer settings are persisted via
  `apps/electron/src/renderer/lib/local-storage.ts`.
- Locale parity requires new runtime translation keys in every locale file.

## 3. Files inspected
- `docs/tickets/T528-session-pins-inline-organization.md`
- `docs/tickets/T529-inline-rename-quick-labels.md`
- `docs/tickets/T533-skill-marketplace-foundation.md`
- `apps/electron/src/renderer/components/app-shell/SessionList.tsx`
- `apps/electron/src/renderer/components/app-shell/SessionItem.tsx`
- `apps/electron/src/renderer/components/app-shell/SessionSearchHeader.tsx`
- `apps/electron/src/renderer/hooks/useSessionSearch.ts`
- `apps/electron/src/renderer/components/ui/entity-list.tsx`
- `apps/electron/src/renderer/lib/local-storage.ts`
- `packages/shared/src/i18n/locales/en.json`
- `packages/shared/src/i18n/locales/ru.json`

## 4. Tests added first
Added `apps/electron/src/renderer/components/app-shell/__tests__/SessionMonitorView.rtl.test.tsx`.

Covered:
- View-mode normalization falls back to `list` for unknown stored values.
- Kanban grouping preserves configured status order.
- Empty configured statuses remain visible as columns.
- Unknown/custom statuses render after configured statuses.
- Toolbar buttons expose the List/Kanban callback contract.

## 5. Expected failing test output
Targeted RTL initially caught a contract drift after implementation:

```text
FAIL  src/renderer/components/app-shell/__tests__/SessionMonitorView.rtl.test.tsx
AssertionError: expected unknown/custom status label "waiting-for-human"
Received: "status:waiting-for-human:waiting-for-human"
```

The helper now keeps configured statuses localized and renders unknown/custom
status labels from the raw status id.

## 6. Implementation changes
- Added `SessionMonitorToolbar` with compact List/Kanban icon buttons.
- Added `session-monitor-view.ts` for persisted mode normalization and Kanban
  grouping.
- Wired `SessionList` to render the existing grouped list by default and a
  status-column Kanban board when selected.
- Kept active search in list mode even when Kanban is selected.
- Persisted view mode with `KEYS.sessionMonitorViewMode`.
- Added locale keys for the monitor toolbar and board labels across all 7
  locales.

## 7. Validation commands run
- `bun run test:rtl -- src/renderer/components/app-shell/__tests__/SessionMonitorView.rtl.test.tsx`
- `bun run typecheck:electron`
- `bun run lint:electron`
- `bun run lint:i18n:parity`
- `bun run lint:i18n:sorted`
- `bun run lint:i18n:coverage`
- `bun run validate:ci`
- `git diff --check`

## 8. Passing test output summary
- RTL targeted: 1 file, 3 tests passed.
- Electron typecheck: passed.
- Electron lint: 0 errors, 7 pre-existing warnings.
- i18n parity: 7 locales, 1596 keys each.
- i18n coverage: 1522 literal references, 1160 files scanned.

## 9. Build output summary
- `validate:ci` passed after local build-output ownership was repaired for
  `apps/marketing/dist`.
- Audit smoke built webui, viewer, and marketing with 0 findings.

## 10. Remaining risks
- Kanban columns are monitoring-only; drag/drop status mutation is intentionally
  out of scope for this slice.
- Locale strings are direct translations and may need product copy review.

## 11. Acceptance criteria matrix
| Criterion | Status | Evidence |
| --- | --- | --- |
| List/Kanban monitor toggle is visible in the session monitor header | Done | `SessionMonitorToolbar` rendered in `SessionList` header |
| Selected monitor view persists locally | Done | `KEYS.sessionMonitorViewMode` read/write path |
| Kanban view groups visible sessions by session status | Done | `buildSessionMonitorKanbanGroups` + targeted RTL |
| Configured status columns keep configured order and show empty columns | Done | RTL helper test |
| Unknown/custom status columns render after configured statuses | Done | RTL helper test |
| Active search renders list results even when Kanban is selected | Done | `useKanbanLayout = monitorViewMode === 'kanban' && !isSearchMode` |
| Tests pass | Done | Targeted RTL, typecheck, lint/i18n, validate:ci |
| Worklog complete | Done | This file |
| Commit created | Done | This commit |
