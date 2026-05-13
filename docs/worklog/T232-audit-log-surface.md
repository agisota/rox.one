# T232 worklog — RBAC audit-log surface

## 1. Goal

Ship the consumer surface for the M.1.5 audit storage substrate now
that T246 (PR #99) wired emit points across RBAC handlers + mission
scheduler. The surface is a read-only admin panel that the operator
can use to inspect recent audit activity.

## 2. Approach

Four atomic commits, one per layer:

1. **Pure reducer** at `audit-log-state.ts` — filter + group by day +
   paginate. Independent of UI; bun:tested.
2. **UI components** — `AuditLogPanel.tsx` + `AuditEventSource`
   injection interface. The panel renders the reducer output and
   surfaces filter controls.
3. **Page wrapper + settings registry wiring** — page mounts at
   `/settings/audit-log`; registry surfaces it in the sidebar.
4. **i18n** — 2 keys × 8 locales.

## 3. Decisions

- **Injected `AuditEventSource`** — the panel never talks to a real
  RPC; it consumes an interface so tests can inject deterministic
  data and T232b can drop the real implementation in without
  reshaping the panel.
- **Reducer is pure** — filtering, grouping, paginating are all
  pure functions over the event list; no React or DOM dependencies.
- **Day grouping uses UTC** per user rules (timestamps stored as
  UTC; display layer converts).

## 4. Files touched

| Path                                                                              | Status |
| --------------------------------------------------------------------------------- | ------ |
| `apps/electron/src/renderer/components/settings/rbac/audit-log-state.ts`          | new    |
| `apps/electron/src/renderer/components/settings/rbac/AuditLogPanel.tsx`           | new    |
| `apps/electron/src/renderer/components/settings/rbac/__tests__/audit-log-state.test.ts` | new |
| `apps/electron/src/renderer/pages/settings/AuditLogSettingsPage.tsx`              | new    |
| 5 settings registry files                                                         | edited |
| `packages/shared/src/i18n/locales/{en,de,es,hu,ja,pl,ru,zh-Hans}.json`            | edited |
| `docs/tickets/T232-audit-log-surface.md`                                          | new    |
| `docs/worklog/T232-audit-log-surface.md`                                          | new    |

## 5. Validation

- bun:test reducer suite — pass
- `bun run lint:i18n:parity` — pass (8 locales)
- `bun run validate:agent-contract` — pass
- `bun run validate:roadmap` — pass

## 6. Closeout

- M.2 (RBAC slice) closes with: T224 (foundation), T225 (policy
  engine), T226 (resolver), T227 (admin RPC), T228 (admin UI),
  T229 (e2e), T230 (ADR), T231 (team management view), T232
  (audit-log surface), T244 (schema reservation, follow-on from
  T243 finding), T246 (audit-wire).
- The RBAC slice is now feature-complete; remaining hardening
  (property tests for the resolver, RPC-handler fuzz) lands as
  M.13 tickets later in the roadmap.
