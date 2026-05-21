# WT-21 — Notification Preferences UI

- **Дата:** 2026-05-21
- **Статус:** Spec — draft
- **Branch:** `feat/notif-prefs-ui`
- **Base SHA:** `fac6f228069c`
- **Wave:** 1
- **Priority:** P1
- **Epic:** PZD-115 (E04 Notifications & Mailbox)
- **Featurebase board:** Frictionless UX (`6a0db0e7d1e3f457181dd1dd`)
- **Depends on:** WT-19 (email-provider, для preference persistence backend)
- **Blocks:** —

---

## 1. Цель и обоснование

Pre-v1 у пользователя нет точечного контроля над уведомлениями: всё или ничего, fly-by-night
spam риск. Регуляторно — CAN-SPAM / GDPR / российский закон №152-ФЗ — требуют возможности
opt-out из всех **не-обязательных** рассылок per-channel + per-event-type. Билет WT-21 решает
оба пункта: UI в Settings → Notifications, persistence через WT-19 backend, hard-rule lock на
security/billing.

---

## 2. Scope (in)

**UI surface:**

```
apps/electron/src/renderer/pages/settings/notifications/
├── NotificationsSettingsPage.tsx        # главный экран
├── NotificationsSettingsPage.test.tsx
├── ChannelToggle.tsx                    # реюзабл per-канал toggle
├── EventCategoryRow.tsx                 # row per event-type × channels
├── MandatoryBadge.tsx                   # «нельзя выключить» индикатор
├── usePrefStore.ts                      # zustand/jotai-style local store + IPC sync
└── __tests__/
    ├── mandatory-lock.test.tsx
    └── ipc-sync.test.tsx
```

**Каналы v1:** `email`, `in-app`, `slack` (slack как future-disabled toggle с «coming soon»).

**Event categories v1** (соответствуют WT-20 templates + system events):

| Category | Channels available | Mandatory? |
|---|---|---|
| Security alerts (login-otp, suspicious login) | email | **Yes** — заблокирован |
| Billing & receipts | email | **Yes** — заблокирован |
| Team invites | email, in-app | No |
| Agent run completions | email, in-app, slack | No |
| Weekly digest | email | No |
| Product announcements | email, in-app | No |

**Hard rule (UI level + backend level):** mandatory rows показывают `<MandatoryBadge>`, toggles
disabled+greyed-out + tooltip «Обязательно по соображениям безопасности/закона». Backend (WT-19)
дублирует проверку: PATCH preferences отвергает попытку выключить mandatory с HTTP 422.

**IPC contract** (renderer ↔ main, через existing `account-api.ts` style):

```typescript
// renderer side
window.rox.notifications.getPreferences(): Promise<NotificationPreferences>;
window.rox.notifications.updatePreferences(diff: Partial<NotificationPreferences>): Promise<NotificationPreferences>;

// main side handler validates mandatory locks before persisting
```

---

## 3. Out of scope (defer)

- Slack integration backend (WT-39 mcp-connector-packs может покрыть позднее).
- Push notifications (mobile — отдельный roadmap).
- SMS канал (требует доп. провайдер + budget approval).
- Per-tenant override (admin принудительно включает категорию для всех) — WT-17 RBAC admin UI.
- Notification scheduling / quiet hours — WT-36 day-tracking может расширить.

---

## 4. Data contract

```typescript
// packages/shared/src/notification/preferences.ts (новый файл, owned by WT-21)
export type NotificationChannel = 'email' | 'in-app' | 'slack';

export type NotificationEventCategory =
  | 'security'
  | 'billing'
  | 'team-invite'
  | 'agent-run'
  | 'weekly-digest'
  | 'product-announcement';

export interface NotificationPreferenceRow {
  category: NotificationEventCategory;
  channels: Partial<Record<NotificationChannel, boolean>>;
  mandatory: boolean;
}

export interface NotificationPreferences {
  userId: string;
  rows: NotificationPreferenceRow[];
  updatedAt: string;
}

// hard-coded mandatory map; UI и backend читают один и тот же source-of-truth
export const MANDATORY_CATEGORIES: readonly NotificationEventCategory[] = [
  'security',
  'billing',
] as const;
```

---

## 5. Acceptance Criteria

| # | AC | Verification |
|---|---|---|
| AC1 | Settings → Notifications рендерит 6 категорий с каналами per AC | RTL render test |
| AC2 | Toggling «agent-run / email» обновляет local store optimistically + IPC PATCH | act+await assertion |
| AC3 | Mandatory rows показывают `<MandatoryBadge>` и toggles `disabled` | mandatory-lock.test.tsx |
| AC4 | Попытка PATCH `security.email = false` через IPC handler → 422 + rollback UI | ipc-sync.test.tsx |
| AC5 | Page доступен через keyboard nav (Tab/Shift+Tab/Space toggle), axe-core зелёный | a11y test |
| AC6 | Локализован en/ru через existing i18n registry; нет hardcoded русских строк | locale-parity test extension |
| AC7 | Feature flag `rox.feature.notif-prefs.ui` default OFF → settings nav скрывает entry | flag-off test |
| AC8 | Slack channel rows показывают «Coming soon», toggle disabled (но НЕ как mandatory) | coming-soon test |

---

## 6. TDD план

1. **T1 — NotificationsSettingsPage.test.tsx render:** 6 категорий присутствуют.
2. **T2 — mandatory-lock.test.tsx:** security/billing toggles disabled, MandatoryBadge visible.
3. **T3 — ipc-sync.test.tsx:** mock IPC, optimistic update, rollback on 422.
4. **T4 — channel-toggle.test.tsx:** click → store update → IPC call.
5. **T5 — a11y.test.tsx:** keyboard navigation + axe-core zero violations.
6. **T6 — locale-parity test extension:** все strings есть в en+ru.
7. **T7 — feature-flag.test.tsx:** OFF путь скрывает nav entry.
8. **T8 — backend handler test (main):** mandatory PATCH attempt → 422.

---

## 7. Файловый allowlist

```yaml
files_allowed:
  - apps/electron/src/renderer/pages/settings/notifications/**
  - apps/electron/src/main/notifications-prefs-handler.ts
  - apps/electron/src/main/notifications-prefs-handler.test.ts
  - packages/shared/src/notification/preferences.ts
  - packages/shared/src/notification/__tests__/preferences.test.ts
files_forbidden:
  - apps/electron/src/renderer/pages/settings/settings-pages.ts  # WT-00 owns (scaffold-request)
  - apps/electron/src/renderer/pages/settings/SettingsNavigator.tsx  # scaffold-request
  - package.json
  - tsconfig*.json
  - packages/shared/src/notification/templates/**   # WT-20 territory
```

Scaffold-request к WT-00:
- Добавить nav entry «Notifications» в `settings-pages.ts` + route в `SettingsNavigator.tsx`.

---

## 8. Inspiration repos

| # | URL | Integration | Rationale |
|---|---|---|---|
| 1 | https://github.com/posthog/posthog/tree/master/frontend/src/scenes/settings | reference_only | Settings page composition + i18n. |
| 2 | https://github.com/usebruno/bruno/tree/main/packages/bruno-app/src/components/Preferences | reference_only | Toggle-grid layout pattern. |
| 3 | https://github.com/sendgrid/sendgrid-nodejs (settings docs) | reference_only | Mandatory channel UX (legal-required). |
| 4 | https://github.com/discord/notifications-ui-patterns (gist) | concept | Category × channel matrix. |
| 5 | https://github.com/raycast/extensions/tree/main/extensions (settings) | reference_only | Liquid Glass-aligned visual taste. |

---

## 9. Verification & 3-machine

- **mac-14-arm:** screenshot Settings → Notifications, axe-core report attached.
- **windows-2022:** same + keyboard nav video (или JSON event log).
- **ubuntu-22:** same.

Smoke: open settings → click Notifications → toggle agent-run/email → verify IPC PATCH 200 →
attempt PATCH security/email=false → verify 422 + UI rollback.

---

## 10. Linear/Featurebase sync

- **Linear parent:** PZD-115. Sub-issues: discovery / design / impl / verify / a11y-audit.
- **Featurebase board:** Frictionless UX `6a0db0e7d1e3f457181dd1dd`. Post alias: `wt-21-notif-prefs-ui`.

---

## 11. Definition of Done

- [ ] TDD-first 8 failing tests committed
- [ ] All tests pass
- [ ] typecheck / lint green
- [ ] axe-core zero violations
- [ ] Locale parity en+ru
- [ ] Mandatory lock verified UI + backend
- [ ] Feature flag default OFF
- [ ] 3-machine screenshots attached
- [ ] Linear Done, FB Shipped

## 23. Mission control axes (v2 update 2026-05-21)

- **Work type:** new_module
- **CJM scenarios required:** manage-notification-prefs
- **UI surfaces affected:** NotificationPrefsPage
- **Entities touched (WT-46 references):** NotificationPreference
- **Events emitted (WT-49 ActivityEvent):** pref.changed
- **AI context implications (WT-48):** N/A
- **Search index implications (WT-50):** N/A
- **12-gate artifacts required:** cjm/*.md (если cjm_scenarios), erd/entities.mmd, sequence/*.mmd, ui-inventory/*.md (если ui_surfaces), evidence/{mac,win,linux}/, observability/metrics.md
- **Heptabase parity:** N/A
- **Risk axes:** UI, data
