# WT-56: Journals + Daily Notes

**Branch:** `feat/journals-daily` | **Wave:** 2 | **Priority:** P2 | **Flag:** `rox.feature.journals-v1` (OFF) | **Cut:** ui
**Parent epic:** PZD-122 (E11 Workspaces) | **FB board:** Frictionless UX (`6a0db0e7d1e3f457181dd1dd`)

## 1. Objective
Daily/weekly/monthly journals as ContentObject{type='journal'} с auto-date title (`2026-05-21`). Auto-creates on first daily activity. Backlinks (WT-47) to cards/tasks/sessions created/edited that day.

## 2. User goal
Open Journals → Today → auto-created daily note → blocks для morning intent + evening reflection. Backlinks sidebar показывает что было сделано: cards edited, sessions started, tasks completed.

## 3. Files allowed
- `packages/shared/src/core/journal.ts`
- `packages/shared/src/journal-service/*` + `__tests__/`
- `apps/electron/src/renderer/pages/journals/JournalsPage.tsx`
- `apps/electron/src/renderer/pages/journals/DailyNote.tsx`
- `apps/electron/src/renderer/pages/journals/Calendar.tsx`
- `apps/electron/src/renderer/pages/journals/__tests__/*.test.tsx`

## 4. Files forbidden
WT-46/47/51 cores. Root scaffolds.

## 5. Depends on
WT-46 (Journal = ContentObject{type='journal'}), WT-47 (backlinks), WT-51 (BlockEditor reused).

## 6. Blocks
None.

## 7. Functional requirements
- **FR-1**: Daily note ID format: `journal:<workspaceId>:<YYYY-MM-DD>`.
- **FR-2**: Auto-create on first daily activity (login, command palette open, any mutation).
- **FR-3**: Calendar view (month grid), highlight days with content.
- **FR-4**: Backlinks aggregation: query WT-47 для objects touched today (created/updated/edited).
- **FR-5**: Weekly review template: previous 7 daily notes summary с AI summarize button (WT-48).
- **FR-6**: Monthly review: same но 30 days.
- **FR-7**: Reusable BlockEditor from WT-51.

## 8. Non-functional requirements
- **NFR-1**: Daily note load < 50ms.
- **NFR-2**: Calendar month render < 100ms.

## 9. Data model
Uses WT-46 ContentObject{type='journal'} + metadata: `{date: 'YYYY-MM-DD', period: 'daily'|'weekly'|'monthly'}`. Lifestreams via WT-47.

## 10-12. API/UI/Security
`journal:getOrCreate(workspaceId, date)`, `journal:getRangeBacklinks(workspaceId, start, end)`. Calendar nav: ←/→ days, J for today. Tenant-isolated.

## 13. TDD test list
T-1: getOrCreate idempotent — same date twice returns same Journal. T-2: auto-create on login. T-3: Calendar highlights days with content. T-4: backlinks aggregation returns objects edited today. T-5: weekly review aggregates 7 days. T-6: BlockEditor reused (no fork). T-7: AI summarize uses scope='workspace' с date filter. T-8: a11y keyboard ←/→ J. T-9: empty state: "Welcome to today" CTA. T-10: cross-tenant journal query empty.

## 14. AC
10 TDD + 3-machine screenshots + axe-clean + typecheck/lint exit 0.

## 15-22. Standard
Standard roles, Linear PZD-122, 4 stories. FB alias `wt-56-journals-daily`. Inspiration: https://wiki.heptabase.com/ (concept — Heptabase Journals), https://github.com/devxoul/vibe-notion (concept), https://github.com/agisota/portal (reference_only), https://github.com/Developer-Mike/obsidian-advanced-canvas (reference_only), https://github.com/JerryZLiu/Dayflow (reference_only — daily review UX).

## 23. Mission control axes
- **Work type:** new_module
- **CJM scenarios:** open-todays-journal, view-weekly-review, navigate-calendar
- **UI surfaces:** JournalsPage, DailyNote, Calendar, BacklinksSidebar
- **Entities touched:** ContentObject{type=journal}
- **Relations touched (WT-47):** all object touches того дня
- **Events emitted (WT-49):** journal.created, journal.opened
- **AI context (WT-48):** weekly/monthly review uses scope='workspace' + date filter
- **Search index (WT-50):** journals indexed
- **Heptabase parity:** Journals (daily/weekly/monthly review)
- **Risk axes:** UI
