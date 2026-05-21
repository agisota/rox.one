# WT-19 — Transactional email provider abstraction — Design

**Дата:** 2026-05-21
**Статус:** Design — awaiting approval
**Branch:** `feat/email-provider`
**Base SHA:** `fac6f228069c`
**Depends on:** WT-04 (user identity contract)
**Blocks:** WT-20 (templates), WT-21 (notif prefs UI), WT-22 (mailbox), WT-15
(invite emails)
**Wave:** 1
**Epic:** PZD-115 (E04 Notifications / messaging)
**FB Board:** `6a0db1b591b619c8111329f2` (Compounding & Collaboration)

---

## 1. Цель

Текущий ROX.ONE не имеет transactional email layer. WT-19 строит **provider
abstraction** (interface) + **3 stub adapters** (Postmark, AWS SES, SendGrid)
+ **NotificationEvent contract**. Будущие WT (20-22, 15) полагаются на эту
abstraction.

**Stub adapters в v1.0:** Все 3 адаптера реализованы как **stub** (логируют в
консоль + пишут в local file `notifications/outbox/*.json`). Production-grade
sending — defer к v1.1 после legal review provider ToS + secret management.

---

## 2. Архитектура

### 2.1 Layers

```
┌──────────────────────────────────────────────────────────────┐
│   NotificationService (consumer — WT-15, WT-20, WT-22)       │
│   await service.send({ type: 'invite.email', to, payload })  │
└─────────────────────────┬────────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────────┐
│   EmailProvider interface (packages/shared/src/notification/  │
│   email-provider.ts)                                          │
│   • send(message: EmailMessage): Promise<SendResult>          │
│   • verify(): Promise<HealthCheck>                            │
│   • parseWebhook(req): WebhookEvent | null                    │
└─────────┬─────────────┬─────────────┬────────────────────────┘
          ▼             ▼             ▼
   PostmarkAdapter  SESAdapter  SendGridAdapter
   (stub)          (stub)       (stub)
          ▼             ▼             ▼
   StubOutboxWriter (notifications/outbox/<uuid>.json)
```

### 2.2 Contracts

```ts
// packages/shared/src/notification/email-provider.ts

export interface EmailMessage {
  readonly id: string;                // UUIDv7
  readonly to: ReadonlyArray<EmailRecipient>;
  readonly from: EmailAddress;
  readonly subject: string;
  readonly body: EmailBody;           // {text, html}
  readonly headers?: Readonly<Record<string, string>>;
  readonly attachments?: ReadonlyArray<EmailAttachment>;
  readonly metadata: EmailMetadata;
  readonly idempotencyKey: string;    // mandatory
}

export interface EmailMetadata {
  readonly tenantId: string;
  readonly workspaceId?: string;
  readonly userId?: string;
  readonly notificationType: NotificationType;
  readonly traceId: string;
}

export type NotificationType =
  | 'invite.email'
  | 'invite.reminder'
  | 'membership.welcome'
  | 'membership.revoked'
  | 'security.suspicious-login'
  | 'audit.weekly-digest'
  | 'mailbox.registered'
  | 'system.announcement';

export interface SendResult {
  readonly ok: boolean;
  readonly providerMessageId?: string;
  readonly error?: { code: string; message: string; retryable: boolean };
  readonly sentAt: string;             // ISO
}

export interface EmailProvider {
  readonly name: 'postmark' | 'ses' | 'sendgrid' | 'stub';
  send(message: EmailMessage): Promise<SendResult>;
  verify(): Promise<{ healthy: boolean; latencyMs: number; error?: string }>;
  parseWebhook(req: { body: string; headers: Record<string, string> }):
    WebhookEvent | null;
}

export type WebhookEvent =
  | { kind: 'delivered'; messageId: string; deliveredAt: string }
  | { kind: 'bounce'; messageId: string; reason: string; permanent: boolean }
  | { kind: 'complaint'; messageId: string; type: 'spam' | 'abuse' }
  | { kind: 'open'; messageId: string; openedAt: string }
  | { kind: 'click'; messageId: string; url: string; clickedAt: string };
```

### 2.3 NotificationEvent contract

```ts
// packages/shared/src/notification/notification-event.ts

export interface NotificationEvent {
  readonly id: string;                 // UUIDv7
  readonly type: NotificationType;
  readonly tenantId: string;
  readonly recipient: EmailRecipient;
  readonly payload: Record<string, unknown>;  // type-specific, validated по schema
  readonly traceId: string;
  readonly createdAt: string;
}

// Schema registry per NotificationType:
export const NotificationPayloadSchemas: Record<NotificationType, z.ZodType> = {
  'invite.email': z.object({
    inviteToken: z.string(),
    inviterName: z.string(),
    workspaceName: z.string(),
    expiresAt: z.string().datetime(),
  }),
  // ... 7 others
};
```

### 2.4 Stub adapter behavior

```ts
class StubEmailAdapter implements EmailProvider {
  readonly name = 'stub';
  async send(message: EmailMessage): Promise<SendResult> {
    await this.outbox.write(message);   // notifications/outbox/<uuid>.json
    log.info({ messageId: message.id, to: message.to, type: message.metadata.notificationType },
             'stub email sent');
    return { ok: true, providerMessageId: `stub_${message.id}`, sentAt: new Date().toISOString() };
  }
  async verify() { return { healthy: true, latencyMs: 0 }; }
  parseWebhook() { return null; }  // stub doesn't receive webhooks
}
```

Postmark/SES/SendGrid adapters в v1 — **тот же stub behavior**, но с
`provider.name` соответственно установленным. Это позволяет тестировать
provider selection logic без реальной отправки.

### 2.5 Provider selection

```ts
// packages/shared/src/notification/provider-factory.ts
export function createEmailProvider(config: EmailProviderConfig): EmailProvider {
  switch (config.provider) {
    case 'postmark': return new PostmarkAdapter(config.postmark!);
    case 'ses':      return new SESAdapter(config.ses!);
    case 'sendgrid': return new SendGridAdapter(config.sendgrid!);
    case 'stub':     return new StubEmailAdapter();
    default:         throw new Error(`unknown provider: ${config.provider}`);
  }
}
```

Config из ENV: `ROX_EMAIL_PROVIDER=stub|postmark|ses|sendgrid` + provider-specific
secrets (read-only stubs ignore secrets).

### 2.6 Idempotency

Каждый `send()` принимает `idempotencyKey`. Provider implementations
обязаны:
- Stub: проверять `notifications/outbox/idempotency/<key>` lock-файл; если
  существует — возвращать cached SendResult.
- Real adapters: использовать provider's idempotency header (Postmark
  `X-PM-Tag`, SES `X-SES-CONFIGURATION-SET-MESSAGE-TAGS`, SendGrid custom args).

---

## 3. AC

1. **AC-01 — Interface compliance:** Все 4 adapter classes (Postmark, SES,
   SendGrid, Stub) реализуют `EmailProvider` interface; TypeScript compile
   verifies.
2. **AC-02 — Stub outbox:** `StubEmailAdapter.send` пишет JSON-файл в
   `notifications/outbox/<message.id>.json`, файл содержит full message +
   sentAt timestamp.
3. **AC-03 — Idempotency:** Двойной `send` с same `idempotencyKey` возвращает
   same SendResult.providerMessageId (cached); outbox файл не дублируется.
4. **AC-04 — Schema validation:** `NotificationEvent` с payload, не
   соответствующим `NotificationPayloadSchemas[type]`, throws ValidationError;
   send aborted before adapter call.
5. **AC-05 — Provider selection:** `createEmailProvider({provider:'postmark'})`
   returns instance с `name === 'postmark'`; unknown provider throws.
6. **AC-06 — Health check:** `provider.verify()` returns `{healthy, latencyMs}`;
   stub always healthy; latencyMs measured.
7. **AC-07 — Webhook parsing (stub):** `parseWebhook` always returns null для
   stub; для real adapters — defer behavior к v1.1, тесты verify interface
   shape only.

---

## 4. TDD план

Файл: `packages/shared/src/notification/__tests__/email-provider.test.ts`

1. **test-01:** `StubEmailAdapter.send` writes outbox file at expected path;
   file content matches input message (without raw secrets).
2. **test-02:** Idempotent send: 2 calls with same key → 1 file, 2 results
   with same providerMessageId.
3. **test-03:** Payload schema validation: `invite.email` без `inviteToken`
   field → throws `NotificationPayloadInvalidError`.
4. **test-04:** All 4 schemas — minimal valid example for each
   NotificationType parses without error.

Файл: `packages/shared/src/notification/__tests__/provider-factory.test.ts`

5. **test-05:** Factory returns adapter с matching `name`; missing config for
   chosen provider → throws `EmailProviderConfigError`.
6. **test-06:** ENV `ROX_EMAIL_PROVIDER=stub` без other vars → factory успешно
   создаёт StubEmailAdapter.

Файл: `packages/shared/src/notification/__tests__/notification-event.test.ts`

7. **test-07:** NotificationEvent → EmailMessage conversion: tenantId,
   traceId, idempotencyKey корректно проброшены в metadata.

---

## 5. Inspiration repos

| Repo | Pattern | License |
|---|---|---|
| `wasp-lang/open-saas` | Email sending integration (Postmark/SendGrid) в SaaS | MIT |
| `anomalyco/openauth` | Provider abstraction patterns (interfaces + factories) | MIT |
| `Mail-0/Zero` | Privacy-first email client — webhook event taxonomy | MIT |
| `agisota/mautic` | Multi-channel automation с email triggers | NOASSERTION |
| `agisota/senpi` | Extension-first adapter pattern для plug-and-play providers | MIT |

---

## 6. Definition of Done

- [ ] Tests-first commit precedes feat commits
- [ ] All 7 tests pass
- [ ] `bun run typecheck` clean
- [ ] `bun run lint` clean
- [ ] 3-machine smoke: stub adapter sends 10 mock emails, outbox files
      readable, idempotency verified
- [ ] No actual network calls в test/CI (stub-only)
- [ ] Feature flag `rox.feature.email-provider` default OFF в production;
      OFF → factory throws при попытке create non-stub
- [ ] Documentation: ENV var matrix в `docs/notification/email-provider.md`
      (≤ 1 page)
- [ ] No leftover TODO/console.log

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Production accidental real-send (stub mis-config) | Default config `stub` + factory guard: non-stub throws unless `ROX_EMAIL_PROVIDER_LIVE=1` env explicitly set |
| Secret leak в logs | Log redaction в send(): redact `headers.authorization`, body never logged |
| Schema drift between consumers и WT-19 | Single source of truth `NotificationPayloadSchemas`; consumers import + zod-parse |
| Webhook signature absence в stubs leading to dev bugs | Real adapters в v1.1 обязаны verify signature; v1 tests assert interface shape only |

---

## 8. Open questions

1. SendGrid vs Postmark default — для US enterprise? — **defer to legal+pricing review**.
2. Local DKIM signing для outbound — нужно для `@rox.one` mailbox (WT-22)? —
   **defer к WT-22 mailbox-domain decision**.
3. Bounce/complaint webhook handling — v1.1 или v1.2? — **v1.1, после first
   beta send-volume**.

## 23. Mission control axes (v2 update 2026-05-21)

- **Work type:** integration
- **CJM scenarios required:** N/A
- **UI surfaces affected:** N/A
- **Entities touched (WT-46 references):** EmailProvider
- **Events emitted (WT-49 ActivityEvent):** email.sent, email.bounced
- **AI context implications (WT-48):** N/A
- **Search index implications (WT-50):** N/A
- **12-gate artifacts required:** cjm/*.md (если cjm_scenarios), erd/entities.mmd, sequence/*.mmd, ui-inventory/*.md (если ui_surfaces), evidence/{mac,win,linux}/, observability/metrics.md
- **Heptabase parity:** N/A
- **Risk axes:** data, security
