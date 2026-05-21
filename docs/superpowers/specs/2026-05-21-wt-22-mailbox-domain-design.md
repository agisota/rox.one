# WT-22 — Mailbox Domain Provisioning (`user@rox.one`)

- **Дата:** 2026-05-21
- **Статус:** Spec — draft (spike-leaning, v1 scope намеренно узкий)
- **Branch:** `feat/mailbox-domain`
- **Base SHA:** `fac6f228069c`
- **Wave:** 1
- **Priority:** P2 (зависит от business decision о tier-quota — Open Q24)
- **Epic:** PZD-115 (E04 Notifications & Mailbox)
- **Featurebase board:** Compounding
- **Depends on:** WT-13 (username-claim), WT-19 (email-provider)
- **Blocks:** —

---

## 1. Цель и обоснование

`user@rox.one` — это flagship-фича компаундирующего эффекта: каждый user получает persistent
email-identity на нашем домене, что (a) превращает username в портабельный ID, (b) даёт нам
inbound channel для product-related замечаний, (c) отрезает SaaS-users от ground-truth Gmail/etc.

v1 scope: **provisioning** (DNS + mailbox creation + receive forward), **NOT full IMAP client**.
Outbound полностью отказан (anti-abuse). Inbound — forward на user's «backup email» либо в
in-app inbox (defer to WT-35 notes-MVP).

Spike-level риски документированы; v1 reasonable означает:
- MVP только для `rox.one` apex (не sub-tenants на custom domains).
- Cloudflare for SaaS + Cloudflare Email Routing.
- Hard rate-limit: 1 mailbox per username, 1 username per user (WT-13 enforces).

---

## 2. Scope (in)

**Infrastructure:**

```
infra/cloudflare/
├── mailbox-provisioning.worker.ts          # main worker (apex MX delegate already in DNS)
├── mailbox-provisioning.worker.test.ts
├── wrangler.mailbox-provisioning.example.toml
└── README-mailbox-provisioning.md
```

**Shared contract:**

```
packages/shared/src/mailbox/
├── domain-provisioner.ts                   # Provisioner interface + Cloudflare adapter
├── domain-provisioner.test.ts
├── dns-records.ts                          # MX/SPF/DKIM/DMARC builders
├── dns-records.test.ts
└── index.ts
```

**Главный flow:**

```
1. User claims username `alice` через WT-13 → fires `username-claimed` event
2. Mailbox provisioner consumes event:
   2.1. Resolves Cloudflare Email Routing API
   2.2. POST /accounts/{acct}/email/routing/rules
         from: alice@rox.one
         to: <user.backup_email> (или in-app webhook URL)
   2.3. Verifies route active (polling, 30s timeout)
3. Emits `mailbox-provisioned` event с {username, mailbox, status}
4. Audit log emit через WT-08 contract
5. Optional welcome email через WT-19+WT-20 (template `invite`-like)
```

**DNS records management:**

`rox.one` apex MX/SPF/DKIM/DMARC уже настроены **снаружи этого WT** (DevOps task — Open Q in
master doc). WT-22 не трогает apex DNS records. Worker предполагает их валидное состояние и
fails-fast если health-check не проходит.

---

## 3. Out of scope (defer)

- IMAP/POP3 client / inbox UI (defer to WT-35 notes-MVP could absorb).
- Outbound `user@rox.one` send (anti-abuse, требует отдельный compliance review).
- Custom tenant domains (`@<tenant>.rox.one`) — Wave 3 spike potentially.
- Catch-all / aliases (`alice+work@rox.one`) — defer to v1.1.
- Spam filtering (Cloudflare Email Routing handles base; advanced — defer).
- Migration «существующих» mailboxes — нет таких.
- DKIM private key rotation automation (manual в v1).

---

## 4. Provisioner interface

```typescript
// packages/shared/src/mailbox/domain-provisioner.ts
export interface MailboxProvisionRequest {
  username: string;            // already-claimed via WT-13 (lowercase, validated)
  userId: string;              // for audit + IPC
  forwardTo: string;           // user's backup email OR in-app webhook URL
  tenantId: string;            // multi-tenant scope
}

export interface MailboxProvisionResult {
  ok: boolean;
  mailbox: string;             // alice@rox.one
  routeId?: string;            // Cloudflare Email Routing rule id
  status: 'active' | 'pending-verification' | 'failed';
  error?: { code: string; message: string };
  provisionedAt: string;       // ISO8601
}

export interface MailboxProvisioner {
  provision(req: MailboxProvisionRequest): Promise<MailboxProvisionResult>;
  revoke(mailbox: string): Promise<{ ok: boolean }>;
  status(mailbox: string): Promise<MailboxProvisionResult>;
}

export class CloudflareEmailRoutingProvisioner implements MailboxProvisioner {
  // uses CLOUDFLARE_API_TOKEN from env, never logged
}
```

---

## 5. Acceptance Criteria

| # | AC | Verification |
|---|---|---|
| AC1 | `provision({username: 'alice', forwardTo: 'alice@gmail.com', ...})` создаёт route на Cloudflare и возвращает `status: 'active'` | integration test against mock Cloudflare API |
| AC2 | Username invalid pattern (uppercase, special chars) rejected ДО Cloudflare call | unit validation test |
| AC3 | Worker НЕ логирует `CLOUDFLARE_API_TOKEN` ни в одном path (включая error) | secret-redaction test |
| AC4 | `revoke('alice@rox.one')` удаляет route + emit audit event | revoke test |
| AC5 | Duplicate provision (same username twice) idempotent: возвращает existing route, не создаёт новый | idempotency test |
| AC6 | Cloudflare API failure → result.ok=false, error.code populated, audit event emit | failure-path test |
| AC7 | Feature flag `rox.feature.mailbox.user-at-rox` default OFF → provisioner returns `status: 'failed'` с reason='disabled' | flag-off test |
| AC8 | DNS health-check (MX record exists for `rox.one`) предшествует provision call; fails-fast если нет | health-check test |

---

## 6. TDD план

1. **T1 — username-validation.test.ts:** regex `^[a-z0-9_-]{3,32}$`, reject invalid.
2. **T2 — cloudflare-adapter.test.ts:** mock fetch, assert correct API call + headers.
3. **T3 — secret-redaction.test.ts:** logger spy verifies token never in output.
4. **T4 — idempotency.test.ts:** двойной provision возвращает same routeId.
5. **T5 — revoke.test.ts:** revoke deletes route + audit event.
6. **T6 — failure-path.test.ts:** Cloudflare 500 → result.ok=false + error mapped.
7. **T7 — feature-flag.test.ts:** OFF путь fails-fast с reason='disabled'.
8. **T8 — dns-health.test.ts:** missing MX → fail-fast.
9. **T9 — worker-integration.test.ts:** end-to-end через worker handler.

---

## 7. Файловый allowlist

```yaml
files_allowed:
  - infra/cloudflare/mailbox-provisioning.worker.ts
  - infra/cloudflare/mailbox-provisioning.worker.test.ts
  - infra/cloudflare/wrangler.mailbox-provisioning.example.toml
  - infra/cloudflare/README-mailbox-provisioning.md
  - packages/shared/src/mailbox/**
  - tests/unit/mailbox/**
  - tests/integration/mailbox/**
files_forbidden:
  - infra/cloudflare/rox-one-router.worker.ts          # WT-01 territory
  - infra/cloudflare/rox-one-release-feed.worker.ts    # WT-01 territory
  - infra/cloudflare/wrangler.rox-one.example.toml     # WT-01 territory
  - package.json
  - tsconfig*.json
  - apps/electron/**                                    # WT-22 server-side only
```

Scaffold-request к WT-00:
- Добавить env var docs `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ZONE_ID`
  в central env reference.

---

## 8. Inspiration repos

| # | URL | Integration | Rationale |
|---|---|---|---|
| 1 | https://github.com/cloudflare/workers-sdk (email-routing samples) | reference_only | Cloudflare Email Routing API patterns. |
| 2 | https://github.com/forwardemail/forwardemail.net | reference_only | Email routing service architecture. |
| 3 | https://github.com/migadu/sora (catch-all patterns) | reference_only | DNS provisioning + DKIM rotation. |
| 4 | https://github.com/sendgrid/inbound-parse-webhook-examples | concept | Inbound webhook patterns для future in-app inbox. |
| 5 | https://github.com/postalserver/postal | reference_only (defer) | Self-hosted mail server (если уйдём от Cloudflare). |

---

## 9. Verification & 3-machine

Worker — server-side, не Electron. 3-machine verification адаптирована:

- **mac-14-arm:** `bun test infra/cloudflare/mailbox-provisioning.worker.test.ts` + `bunx wrangler dev --dry-run`.
- **windows-2022:** same.
- **ubuntu-22:** same + `bunx wrangler deploy --dry-run` (final pre-publish gate).

Manual smoke (post-merge, NOT in CI): провизионировать тестовый `wt22-smoke@rox.one`, послать
письмо извне, verify forward, revoke. Evidence — manual test log + redacted screenshot Cloudflare
dashboard.

---

## 10. Linear/Featurebase sync

- **Linear parent:** PZD-115. Sub-issues: discovery / design / impl / verify / manual-smoke.
- **Featurebase board:** Compounding. Post alias: `wt-22-mailbox-domain`.

---

## 11. Risk register (WT-specific)

| Risk | Mitigation |
|---|---|
| Cloudflare Email Routing rate limit (1200 routes/zone) | Tier-based quota (Open Q24); reject >N per tenant. |
| Username squatting | WT-13 enforces 1 username/user + admin-override policy. |
| Backup email enumeration via provision side-channel | Same-message error for «invalid» vs «taken». |
| Outbound abuse if кто-то найдёт SMTP relay | v1: outbound полностью отключен; SPF=-all, не ~all. |
| DKIM private key leak | Stored ТОЛЬКО в Cloudflare worker secrets, never in repo. |

---

## 12. Definition of Done

- [ ] TDD-first 9 failing tests committed
- [ ] All tests pass
- [ ] typecheck / lint green
- [ ] `wrangler deploy --dry-run` succeeds
- [ ] Secret redaction test passes
- [ ] Feature flag default OFF verified
- [ ] Manual smoke evidence attached (post-merge, не CI)
- [ ] Linear Done, FB Shipped

## 23. Mission control axes (v2 update 2026-05-21)

- **Work type:** integration
- **CJM scenarios required:** provision-domain-mailbox
- **UI surfaces affected:** N/A
- **Entities touched (WT-46 references):** MailboxProvisioning
- **Events emitted (WT-49 ActivityEvent):** mailbox.provisioned
- **AI context implications (WT-48):** N/A
- **Search index implications (WT-50):** N/A
- **12-gate artifacts required:** cjm/*.md (если cjm_scenarios), erd/entities.mmd, sequence/*.mmd, ui-inventory/*.md (если ui_surfaces), evidence/{mac,win,linux}/, observability/metrics.md
- **Heptabase parity:** N/A
- **Risk axes:** security, data
