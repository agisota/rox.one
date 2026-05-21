# WT-15 — Membership CRUD + Invite flow — Design

**Дата:** 2026-05-21
**Статус:** Design — awaiting approval
**Branch:** `feat/membership-invite`
**Base SHA:** `fac6f228069c`
**Depends on:** WT-06 (workspace contract), WT-14 (roles engine)
**Blocks:** WT-17 (RBAC admin UI)
**Wave:** 1 — Auth + Team
**Epic:** PZD-113 (E02 Auth, RBAC, multi-tenant)
**FB Board:** `6a0db1dabaed70b5d8d3f898` (Enterprise B2B)

---

## 1. Цель и контекст

WT-15 закрывает критический gap в командном слое: текущий ROX.ONE имеет
RoleStore/GrantStore (WT-14), но нет mechanism'а для приглашения пользователей в
workspace без прямой mutation базы. Этот WT строит **Membership CRUD** (привязка
user × workspace × role) + **Invite flow** с одноразовыми токенами TTL 7 дней.

**Сценарии:**

1. Admin приглашает email-адрес → invite token создаётся → ссылка отправляется
   через NotificationService (WT-19) → invitee регистрируется/логинится → token
   redeem → membership создаётся.
2. Admin удаляет membership → grant revoked → session.permittedWorkspaces
   обновляется → user теряет доступ на следующем тике RBAC resolver.
3. Audit emit на каждое: invite_created, invite_redeemed, invite_revoked,
   membership_created, membership_deleted, membership_role_changed.

**Что не входит:**

- UI admin pages (→ WT-17)
- Email template HTML/MJML (→ WT-20)
- Bulk invite via CSV (defer to v1.2)
- SCIM group sync (→ WT-11)

---

## 2. Архитектура

### 2.1 Слои

```
┌──────────────────────────────────────────────────────────────┐
│   IPC API (apps/electron/src/main/ipc/membership-handler.ts) │
│   • membership.create / .list / .delete / .update-role        │
│   • invite.create / .list / .revoke / .redeem                 │
└─────────────────────────┬────────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────────┐
│   MembershipService (packages/shared/src/team/membership-    │
│   service.ts) — orchestrates store + invite + audit          │
└─────────────────────────┬────────────────────────────────────┘
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   MembershipStore   InviteStore       AuditWriter
   (SQLite,         (SQLite,           (WT-08, existing)
   workspace-       TTL-indexed
   scoped)          tokens)
```

### 2.2 Data model

```ts
// packages/shared/src/team/membership-schema.ts
export const MembershipSchema = z.object({
  id: z.string().uuid(),               // UUIDv7
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  roleId: z.string(),                  // from WT-14 RoleStore
  invitedBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),  // soft-delete
});

// packages/shared/src/team/invite-schema.ts
export const InviteSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  email: z.string().email(),
  roleId: z.string(),                  // assigned at invite-creation time
  token: z.string(),                   // 32-byte base64url, opaque
  tokenHash: z.string(),               // sha256, stored; raw token only in email
  invitedBy: z.string().uuid(),
  expiresAt: z.string().datetime(),    // createdAt + 7d
  redeemedAt: z.string().datetime().nullable(),
  redeemedByUserId: z.string().uuid().nullable(),
  revokedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
```

### 2.3 Invite redemption flow

```
1. POST /invite/redeem { token }
2. Server computes tokenHash = sha256(token)
3. Lookup InviteStore by tokenHash
4. Verify: expiresAt > now, redeemedAt === null, revokedAt === null
5. Resolve current authenticated user (must be logged in)
6. Verify user.email === invite.email (or admin-override flag)
7. Transaction:
   a. INSERT membership(workspaceId, userId, roleId)
   b. UPDATE invite SET redeemedAt=now, redeemedByUserId=user.id
   c. EMIT audit.team.invite_redeemed
   d. EMIT audit.team.membership_created
8. Return { workspaceId, membershipId }
```

**Idempotency:** повторный redeem с уже-redeemed token возвращает 200 OK с тем
же membershipId (если same user). Conflict (другой user) → 409.

### 2.4 Token security

- Token format: 32 random bytes → base64url (≈43 chars)
- Storage: только `sha256(token)` в БД; raw token доступен 1 раз при создании
- Transmission: только через secure email channel (WT-19/20)
- Brute force: rate-limit /invite/redeem 10/min per IP + exponential backoff

---

## 3. AC (Acceptance Criteria)

1. **AC-01 — Создание invite:** Admin с правом `team.invite` создаёт invite на
   email; в ответе получает invite.id; raw token в БД отсутствует (только hash).
2. **AC-02 — TTL 7 дней:** Invite, созданный 7d+1m назад, при попытке redeem
   возвращает 410 Gone с code=`invite.expired`.
3. **AC-03 — Idempotent redeem:** Повторный redeem того же token тем же user →
   200 OK, same membershipId; redeem другим user → 409 Conflict.
4. **AC-04 — Audit emit:** Каждое из {invite_created, invite_redeemed,
   invite_revoked, membership_created, membership_deleted, membership_role_changed}
   эмитит audit event со схемой WT-08.
5. **AC-05 — Soft-delete membership:** DELETE membership проставляет deletedAt;
   physical row сохраняется; LIST по умолчанию исключает deleted.
6. **AC-06 — Role assigned at invite time:** Изменение role в Membership после
   redeem НЕ изменяет существующих memberships других invitees; роль фиксируется
   на момент создания invite.
7. **AC-07 — RBAC integration:** После membership_created sessionRefresher на
   следующем тике (≤30s) обновляет session.permittedWorkspaces у invitee.

---

## 4. TDD план (тесты ДО кода)

Файл: `tests/unit/team/membership-service.test.ts`

1. **test-01:** `MembershipService.createInvite` returns inviteId, persists
   tokenHash, raw token returned exactly once.
2. **test-02:** `MembershipService.redeemInvite` with expired token → throws
   `InviteExpiredError` with code `invite.expired`.
3. **test-03:** Double-redeem by same user → returns same membershipId (idempotent).
4. **test-04:** Redeem by user with different email → throws
   `InviteEmailMismatchError`, audit event NOT emitted.
5. **test-05:** `MembershipService.deleteMembership` sets deletedAt; subsequent
   `listMemberships` excludes it; `listMemberships({includeDeleted: true})` includes.
6. **test-06:** Audit emit assertions: spy on AuditWriter, verify exactly one
   `audit.team.invite_created` event per createInvite call.
7. **test-07:** `MembershipService.updateRole` changes membership.roleId, emits
   `audit.team.membership_role_changed` with before/after payload.

Файл: `tests/integration/team/invite-redeem-flow.test.ts`

8. **test-08:** Full e2e: create invite → mock email send → redeem via IPC →
   verify session.permittedWorkspaces updated после 35s tick.

---

## 5. Inspiration repos

| Repo | Pattern | License |
|---|---|---|
| `wasp-lang/open-saas` | Invite link + email send + role assignment в SaaS boilerplate | MIT |
| `anomalyco/openauth` | Token mint/verify + hash-only storage patterns | MIT |
| `trailbaseio/trailbase` | Multi-tenant membership table schema + admin UI hooks | OSL-3.0 |
| `agisota/senpi` | Extension-first patterns для команды/scope | MIT |
| `Agent-Field/agentfield` | Identity-aware audit emit на каждое team mutation | Apache-2.0 |

---

## 6. Definition of Done

- [ ] Test-first commit precedes feat commit (`git log` verifiable)
- [ ] All 8 tests pass (`bun test tests/unit/team` and `tests/integration/team`)
- [ ] `bun run typecheck` clean
- [ ] `bun run lint` clean
- [ ] 3-machine verification: mac-14-arm, windows-2022, ubuntu-22 builds + smoke
- [ ] Feature flag `rox.feature.team.invite` default OFF; OFF → invite endpoint
      returns 404
- [ ] No leftover console.log / TODO / debugger
- [ ] Audit events visible in WT-08 store after smoke
- [ ] RBAC isolation tests из WT-16 (когда merged) green против membership API

---

## 7. Risk + mitigation

| Risk | Mitigation |
|---|---|
| Token leak via email forwarding | TTL 7d + revoke endpoint + audit on redeem |
| Race condition: 2 redemptions same token | DB transaction + UNIQUE(tokenHash, redeemedAt IS NULL) |
| Role assignment drift при update | Role фиксируется в invite row; membership.roleId копируется в момент redeem |
| Email send failure → invite stuck | Retry с idempotency-key + admin manual resend endpoint |

---

## 8. Open questions

1. Resend invite после revoke — same token (new TTL) или new token? — **decision: new token, новый email send.**
2. Pending invites count в quota — считать или нет? — **defer to WT-24 quota engine.**
3. Email-mismatch override (admin принудительно мапит token на любого user) — нужно? — **нет в v1; defer.**
