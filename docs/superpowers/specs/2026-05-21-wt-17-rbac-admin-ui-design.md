# WT-17 — RBAC admin UI — Design

**Дата:** 2026-05-21
**Статус:** Design — awaiting approval
**Branch:** `feat/rbac-admin-ui`
**Base SHA:** `fac6f228069c`
**Depends on:** WT-14 (roles engine), WT-15 (membership + invites)
**Blocks:** Auth release cut UX validation
**Wave:** 1
**Epic:** PZD-113 (E02 Auth, RBAC, multi-tenant)
**FB Board:** `6a0db1dabaed70b5d8d3f898` (Enterprise B2B)

---

## 1. Цель

Admin UI поверх существующих RoleStore (WT-14) и Membership/Invite services
(WT-15). Три экрана в `apps/electron/src/renderer/pages/admin/rbac/`:

1. **RolesPage** — list roles, view role permissions, create/edit/delete custom role.
2. **GrantsPage** — list memberships в текущем workspace, change role, revoke,
   send invite.
3. **AuditPage** — read-only view последних RBAC audit events (filtered к
   `audit.team.*`, `audit.rbac.*`). Превью для full WT-18 audit UI.

**UX-guru участвует в Phase 2 (Design):** wireframes, style tokens, accessibility
review, keyboard navigation patterns.

---

## 2. Архитектура

### 2.1 File layout

```
apps/electron/src/renderer/pages/admin/rbac/
├── index.tsx                  — route /admin/rbac (redirects to /admin/rbac/roles)
├── RolesPage.tsx
├── GrantsPage.tsx
├── AuditPage.tsx
├── components/
│   ├── RoleListItem.tsx
│   ├── RoleEditor.tsx
│   ├── MembershipRow.tsx
│   ├── InviteModal.tsx
│   └── AuditEventRow.tsx
├── hooks/
│   ├── useRoles.ts
│   ├── useMemberships.ts
│   └── useRbacAudit.ts
└── __tests__/
    ├── RolesPage.test.tsx
    ├── GrantsPage.test.tsx
    └── AuditPage.test.tsx
```

### 2.2 IPC bridge

UI вызывает existing IPC channels:

| Channel | Owner | Use |
|---|---|---|
| `rbac.roles.list` | WT-14 | RolesPage |
| `rbac.roles.create` / `.update` / `.delete` | WT-14 | RoleEditor |
| `team.memberships.list` | WT-15 | GrantsPage |
| `team.memberships.update-role` | WT-15 | MembershipRow |
| `team.memberships.delete` | WT-15 | MembershipRow |
| `team.invite.create` | WT-15 | InviteModal |
| `audit.events.query` | WT-18 (preview) | AuditPage — fallback к local query пока WT-18 не merged |

**Fallback для WT-18 dependency:** Если WT-18 ещё не merged, AuditPage читает
audit store напрямую через existing `auditEventStore.list(filter)`. После merge
WT-18 переключаемся на REST `/api/v1/audit/events`.

### 2.3 UX/design tokens

Используем существующий design system из `apps/electron/src/renderer/design/`:

- Color tokens: `--rox-accent`, `--rox-danger`, `--rox-muted-bg`
- Spacing: 4px grid
- Typography: Inter 14/16/20
- Liquid Glass macOS fallback: see master doc Section 8 Q16

Wireframes (создаются UX-guru в Phase 2):

```
┌─────────────────────────────────────────────────────────┐
│  Admin  ▸  RBAC                  [Roles] [Grants] [Audit]│
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Roles                                    [+ New role]  │
│  ┌─────────────────────────────────────────────────┐   │
│  │ admin            (built-in)        24 grants    │   │
│  │ member           (built-in)        87 grants    │   │
│  │ analyst          (custom)           5 grants    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 2.4 Accessibility

- Все интерактивные элементы reachable via Tab
- ARIA labels на icon-only buttons
- Color contrast ≥ 4.5:1 (WCAG 2.2 AA)
- Focus ring visible
- Screen reader: useRoles loading state announced via aria-live

---

## 3. AC

1. **AC-01 — RolesPage:** Список ролей загружается ≤500ms (n=20); built-in
   roles non-editable (disabled edit button); custom roles editable.
2. **AC-02 — RoleEditor:** Create role с пустым именем → inline validation
   error; имя совпадающее с built-in → error `role.name.reserved`.
3. **AC-03 — GrantsPage:** Membership list paginated по 50 строкам;
   role-change confirms via toast после успешного IPC reply.
4. **AC-04 — InviteModal:** Email validation (RFC 5322), role select из
   списка ролей текущего workspace; submit shows raw token в ОДНО разовом
   диалоге с copy-button.
5. **AC-05 — AuditPage:** Показывает последние 100 RBAC-related events;
   filter по eventType работает; clicking row раскрывает JSON payload.
6. **AC-06 — Keyboard nav:** Все 3 экрана полностью управляются клавиатурой
   (Tab/Shift+Tab/Enter/Esc); тестируется axe-core 0 violations.
7. **AC-07 — Feature flag off:** При `rox.feature.rbac.admin-ui` = OFF,
   route `/admin/rbac` → redirect к 404; нет видимых entry points в nav.

---

## 4. TDD план

Файл: `apps/electron/src/renderer/pages/admin/rbac/__tests__/RolesPage.test.tsx`

1. **test-01:** Renders loading skeleton, then role list, then 0-state fallback
   if list empty.
2. **test-02:** Click "New role" opens RoleEditor in create mode; submit без
   имени → validation error.
3. **test-03:** Built-in role row has disabled "Edit" button + tooltip
   "Built-in roles cannot be edited".

Файл: `.../GrantsPage.test.tsx`

4. **test-04:** Membership row "Revoke" button opens confirm dialog; confirm
   triggers IPC `team.memberships.delete`; row disappears from list.
5. **test-05:** InviteModal copy-button copies raw token to clipboard
   (mocked); subsequent re-open of modal NOT shows the token (one-shot).

Файл: `.../AuditPage.test.tsx`

6. **test-06:** Event list filtered к `audit.team.*` и `audit.rbac.*`;
   eventType filter dropdown updates query.
7. **test-07:** Click row expands JSON payload viewer; Escape collapses.

Файл: `apps/electron/src/renderer/pages/admin/rbac/__tests__/a11y.test.tsx`

8. **test-08:** axe-core run on each of 3 pages → 0 violations.

---

## 5. Inspiration repos

| Repo | Pattern | License |
|---|---|---|
| `trailbaseio/trailbase` | Admin UI built-in (Rust+TS); role management panels | OSL-3.0 |
| `wasp-lang/open-saas` | Admin dashboard React components + tables + modals | MIT |
| `InsForge/InsForge` | Agentic backend admin panel — audit/role UI references | Apache-2.0 |
| `tailscale/hallpass` | Access grant/revoke UI patterns | BSD-3-Clause |
| `Agent-Field/agentfield` | Identity-aware admin UI + audit timeline | Apache-2.0 |

---

## 6. Definition of Done

- [ ] Tests-first commit precedes feat commits
- [ ] All 8 tests green (`bun test apps/electron/src/renderer/pages/admin/rbac`)
- [ ] axe-core 0 violations on each of 3 pages
- [ ] `bun run typecheck` clean
- [ ] `bun run lint` clean
- [ ] 3-machine: mac/win/linux screenshots of each page в evidence/wt-17/
- [ ] Feature flag `rox.feature.rbac.admin-ui` default OFF; OFF → route 404
- [ ] UX-guru sign-off comment in Linear sub-issue
- [ ] Keyboard nav verified manually on each platform; screenshot of focus ring

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| WT-18 not merged when WT-17 ready | Fallback к local audit store query; refactor to REST в follow-up commit |
| UX-guru wireframes diverge от existing design system | Phase 2 review с design system owner; tokens reused, не новые |
| Bundle size growth (>200KB budget violation) | Tree-shake @rox/ui imports; lazy-load AuditPage; per-page bundle audit |
| Screen reader regressions на Windows Narrator | Manual test на windows-2022 runner; aria-live regions tested |

---

## 8. Open questions

1. Built-in role переименование admin → owner — нужно для enterprise? — **defer**.
2. Bulk role change (select N memberships, change all) — v1 или v1.1? — **v1.1 (post-cut)**.
3. Custom permission editor (granular permissions) — UI или JSON-only? — **JSON-only в v1; UI defer к WT-37**.
