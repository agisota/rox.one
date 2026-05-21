# WT-18 — Audit log query API + UI — Design

**Дата:** 2026-05-21
**Статус:** Design — awaiting approval
**Branch:** `feat/audit-log-query`
**Base SHA:** `fac6f228069c`
**Depends on:** WT-08 (audit contract + writer)
**Blocks:** Featurebase enterprise demos
**Wave:** 1
**Epic:** PZD-118 (E07 Observability + audit)
**FB Board:** `6a0db1dabaed70b5d8d3f898` (Enterprise B2B)

---

## 1. Цель

WT-08 даёт audit writer + storage backend. WT-18 надстраивает **query API**
(REST + GraphQL) и **admin UI page** для просмотра audit log с фильтрами
(time-range, actor, event_type, tenant). Это первый customer-facing surface
для compliance/security audits и debugging.

---

## 2. Архитектура

### 2.1 REST API

```
GET /api/v1/audit/events?<filters>

Query params:
  ?from=2026-05-01T00:00:00Z         RFC3339 timestamps (inclusive)
  ?to=2026-05-21T23:59:59Z
  ?actor=user:alice@rox.one          actor format: <type>:<id|email>
  ?event_type=audit.team.*           glob pattern (escaped to regex server-side)
  ?tenant=tenant_01HXY...            scoped to caller's tenant unless admin
  ?cursor=<opaque>                   pagination cursor
  ?limit=100                          max 500

Response 200:
{
  "events": [
    {
      "id": "evt_...",
      "type": "audit.team.invite_created",
      "actor": { "type": "user", "id": "usr_...", "email": "alice@rox.one" },
      "tenant_id": "tnt_...",
      "workspace_id": "wsp_...",
      "occurred_at": "2026-05-20T15:32:01.123Z",
      "payload": { ... },
      "request_id": "req_..."
    }
  ],
  "next_cursor": "...",                // null if no more
  "estimated_total": 12345              // approximate
}
```

**Auth:** Bearer token (existing session JWT); scope `audit:read` required.
Cross-tenant query — only `audit:read:admin` scope (super-admin).

### 2.2 GraphQL alternative

```graphql
type Query {
  auditEvents(
    from: DateTime
    to: DateTime
    actor: String
    eventType: String
    tenantId: ID
    after: String
    first: Int = 100
  ): AuditEventConnection!
}

type AuditEventConnection {
  edges: [AuditEventEdge!]!
  pageInfo: PageInfo!
  estimatedTotal: Int
}
```

GraphQL endpoint: `/api/v1/graphql`. Same auth/scope rules.

### 2.3 Storage backend

Underlying store — WT-08 `AuditEventStore`. WT-18 adds query layer:

```
packages/shared/src/audit/
├── audit-event-store.ts       (existing WT-08 — read/write SQLite)
├── audit-event-writer.ts      (existing WT-08)
├── audit-query.ts             (NEW — composable filter builder)
├── audit-cursor.ts            (NEW — opaque cursor encode/decode)
└── __tests__/audit-query.test.ts
```

**Cursor format:** `base64url({ts: <occurred_at_ms>, id: <event_id>})`. Server
validates cursor signature (HMAC sha256 with `AUDIT_CURSOR_SECRET` env) чтобы
predict tampering.

**Index strategy** (SQLite):

```sql
CREATE INDEX idx_audit_tenant_ts ON audit_events(tenant_id, occurred_at DESC);
CREATE INDEX idx_audit_type ON audit_events(event_type);
CREATE INDEX idx_audit_actor ON audit_events(actor_id);
```

### 2.4 UI page

```
apps/electron/src/renderer/pages/admin/audit-log/
├── index.tsx                  — main AuditLogPage
├── components/
│   ├── FilterBar.tsx          — time-range picker, actor input, event-type dropdown
│   ├── EventTable.tsx         — virtualized list (react-window)
│   ├── EventRow.tsx
│   └── EventDetailDrawer.tsx — slide-in panel with full JSON
├── hooks/
│   ├── useAuditQuery.ts       — REST polling (useQuery)
│   └── useEventTypes.ts       — dropdown options
└── __tests__/
```

**UX:**

- Default view: last 24h
- Time-range presets: 1h / 24h / 7d / 30d / custom
- Filter combinator AND (no OR в v1)
- Virtual scrolling для >1000 rows
- Click row → drawer with full payload + "Copy as cURL replay"
- Export to JSON button (download last query result)

### 2.5 Performance

- Query timeout 5s; if exceeded → return partial results + `truncated: true`
- Estimated_total computed via SQLite `COUNT(*) OVER ()` (capped at 10k)
- UI paginates by 100; lazy loads next page on scroll-bottom

---

## 3. AC

1. **AC-01 — REST query:** `GET /api/v1/audit/events?from=...&to=...` returns
   events ordered by `occurred_at DESC`; limit max 500.
2. **AC-02 — Tenant scoping:** Non-admin token returns ONLY events with
   `tenant_id = caller.tenant_id`; cross-tenant filter param ignored (logged
   as security event).
3. **AC-03 — Event type glob:** `event_type=audit.team.*` matches `invite_*`,
   `membership_*`; `event_type=audit.*` matches all; invalid pattern → 400.
4. **AC-04 — Pagination:** Cursor produced by response N successfully fetches
   page N+1; cursor with tampered signature → 400 `cursor.invalid`.
5. **AC-05 — GraphQL parity:** Same query via GraphQL returns equivalent
   results; pageInfo.hasNextPage matches REST next_cursor presence.
6. **AC-06 — UI page:** AuditLogPage renders 100 events under 200ms (after
   data loaded); filter change debounced 300ms; virtual scroll smooth at 60fps.
7. **AC-07 — Export:** "Export JSON" downloads valid JSON of current query
   result (capped at 5k events to prevent UI freeze).
8. **AC-08 — Feature flag off:** `rox.feature.audit.query` OFF → REST returns
   404; UI route redirect to 404.

---

## 4. TDD план

Файл: `packages/shared/src/audit/__tests__/audit-query.test.ts`

1. **test-01:** `buildAuditQuery({ from, to, eventType })` produces correct
   SQL with parameterized values (no injection).
2. **test-02:** Event-type glob `audit.team.*` compiles to regex
   `/^audit\.team\.[^.]+$/` (single segment); `audit.*` matches anything.
3. **test-03:** Cursor encode/decode round-trip preserves ts+id; tampered
   cursor → throws `CursorInvalidError`.
4. **test-04:** Tenant scoping: non-admin call with `tenantId=other` → filter
   silently overridden to caller's tenant; security audit event emitted.

Файл: `apps/electron/src/main/api/__tests__/audit-route.test.ts`

5. **test-05:** REST `GET /api/v1/audit/events` returns 200 with events;
   pagination via cursor returns next page; final page has `next_cursor: null`.
6. **test-06:** GraphQL query returns same events as REST с матчем по id.

Файл: `apps/electron/src/renderer/pages/admin/audit-log/__tests__/AuditLogPage.test.tsx`

7. **test-07:** Filter change debounced; fast typing produces only one fetch
   after 300ms idle.
8. **test-08:** Click row opens drawer; drawer shows full JSON payload;
   "Copy as cURL replay" copies valid curl command to clipboard.

---

## 5. Inspiration repos

| Repo | Pattern | License |
|---|---|---|
| `Agent-Field/agentfield` | Identity-aware auditable agent execution + query API | Apache-2.0 |
| `trailbaseio/trailbase` | Admin UI с audit timeline + SQLite query layer | OSL-3.0 |
| `InsForge/InsForge` | Backend audit log + admin panel | Apache-2.0 |
| `requestly/requestly` | HTTP interception → mirror для cURL replay UX | NOASSERTION |
| `wasp-lang/open-saas` | Filter bar + paginated table React patterns | MIT |

---

## 6. Definition of Done

- [ ] Tests-first commit precedes feat commits
- [ ] All 8 tests pass
- [ ] REST + GraphQL endpoints registered behind flag
- [ ] `bun run typecheck` clean
- [ ] `bun run lint` clean
- [ ] 3-machine smoke: query 1000 events / paginate / export
- [ ] Screenshots of AuditLogPage в evidence/wt-18/
- [ ] axe-core 0 violations
- [ ] Performance: 100-event render <200ms on ubuntu-22 runner
- [ ] Feature flag default OFF

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Cross-tenant data leak via crafted cursor | HMAC-signed cursor; tenant_id baked into cursor payload + verified server-side |
| Large export DoS (5k JSON in browser) | Cap at 5k events; if user needs more, CSV stream-export defer to v1.1 |
| GraphQL query depth attack | Depth limit 5, complexity limit 1000; envelop plugin enforces |
| Storage scaling (SQLite > 1M events) | Defer ClickHouse migration → master doc Open Question Q7; v1 stays SQLite with 90d retention |

---

## 8. Open questions

1. Real-time streaming subscription (GraphQL subscription / SSE) — v1 or v1.1?
   — **v1.1; WT-31 realtime-ws handles broader subscription layer**.
2. Audit event signing для tamper-evidence — нужно? — **defer to security-review WT**.
3. Storage backend (Q7 master doc) — SQLite vs ClickHouse — заблокировано до
   decision; WT-18 ships с SQLite, abstraction layer permits swap later.
