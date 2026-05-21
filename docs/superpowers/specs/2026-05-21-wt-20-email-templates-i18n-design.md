# WT-20 — Email Templates + i18n Render

- **Дата:** 2026-05-21
- **Статус:** Spec — draft (awaiting per-WT approval, master doc approved)
- **Branch:** `feat/email-templates`
- **Base SHA:** `fac6f228069c` (release/v1.0.3-launch-fixes snapshot)
- **Wave:** 1
- **Priority:** P1
- **Epic:** PZD-115 (E04 Notifications & Mailbox)
- **Featurebase board:** Compounding
- **Depends on:** WT-19 (email-provider)
- **Blocks:** WT-21 (notif-prefs render previews), WT-22 (mailbox onboarding mail)

---

## 1. Цель и обоснование

Каждое транзакционное письмо ROX.ONE — это маркетинговая точка касания + правовой обязательный канал
(security alerts, billing receipts). Сейчас письма отсутствуют как продуктовый артефакт: WT-19
поставляет провайдер (SMTP/Resend/SES adapter), но **рендеринга шаблонов нет**. WT-20 закрывает
этот разрыв: декларативная библиотека шаблонов в `packages/shared/src/notification/templates/*`,
i18n через существующую infra (`packages/shared/src/i18n`), HTML+text dual output, чистая
JSON-friendly variable substitution, и golden-snapshot тесты на каждый локаль/шаблон pair.

**Главный продуктовый принцип:** письма должны быть короткими, дружественными, на языке
получателя (`user.locale` field), с явным CTA и обязательным footer `[unsubscribe | preferences]`
кроме обязательных по закону (security/billing).

---

## 2. Scope (in)

**5 базовых шаблонов v1:**

| Template id | Когда отправляется | Mandatory? | CTA |
|---|---|---|---|
| `invite` | Admin приглашает member в tenant/workspace | No | "Принять приглашение" |
| `login-otp` | OTP/magic link при login без password | **Yes (security)** | OTP code (6 digits, 10 min TTL) |
| `billing-receipt` | После успешной подписки/upgrade | **Yes (billing)** | "Посмотреть инвойс" |
| `task-complete` | Agent run завершился (если notif включен) | No | "Открыть задачу" |
| `weekly-digest` | Воскресенье 18:00 local TZ user | No | "Открыть workspace" |

**Локали v1:** `en`, `ru` (ROX.ONE целевая аудитория). Расширение до 5 локалей в WT-37 future.

**Файловая структура:**

```
packages/shared/src/notification/
├── templates/
│   ├── index.ts                          # registry + render entry point
│   ├── types.ts                          # TemplateId, TemplateContext, RenderResult
│   ├── render.ts                         # render(templateId, locale, ctx) → {html, text, subject}
│   ├── render.test.ts                    # rendering invariants
│   ├── invite/
│   │   ├── invite.template.ts            # exports {subject, html, text} as locale-keyed maps
│   │   ├── invite.context.schema.ts      # Zod schema for required variables
│   │   └── __snapshots__/                # golden snapshots per locale
│   ├── login-otp/
│   ├── billing-receipt/
│   ├── task-complete/
│   └── weekly-digest/
└── __tests__/
    └── template-registry-completeness.test.ts
```

**Renderer:** простой mustache-стиль (`{{var}}` + `{{#if cond}}…{{/if}}`). Безопасный escape по
умолчанию — все `{{var}}` HTML-escaped; `{{{var}}}` для уже-санитизированного HTML (только для
ссылок из allowlist). NO eval, NO Function constructor.

## 3. Out of scope (defer)

- Drag-and-drop visual template editor (defer to WT-21 admin UI extension).
- A/B testing рассылок (отдельный roadmap).
- Marketing campaigns / mass email (нужен dedicated suppression list — WT-37 future).
- MJML responsive emails (WT-37 onboarding-hints WT может расширить).
- Inline tracking pixels (приватность-первый принцип).
- Локали кроме `en`/`ru` (WT-37 future).

---

## 4. Контракт и API

```typescript
// packages/shared/src/notification/templates/types.ts
export type TemplateId =
  | 'invite'
  | 'login-otp'
  | 'billing-receipt'
  | 'task-complete'
  | 'weekly-digest';

export type Locale = 'en' | 'ru';

export interface RenderResult {
  subject: string;
  html: string;   // sanitized, ready for SMTP
  text: string;   // plain-text fallback
  mandatory: boolean; // если true — нельзя отключить через WT-21 prefs
}

export interface TemplateContext {
  // common
  recipient: { name: string; email: string; locale: Locale };
  brand: { productName: string; supportEmail: string; rootUrl: string };
  // template-specific (валидируется Zod в render())
  [k: string]: unknown;
}

export function render(
  templateId: TemplateId,
  locale: Locale,
  ctx: TemplateContext
): RenderResult;
```

Renderer:

1. Загружает `<templateId>.template.ts` → `{ subject, html, text }` объекты keyed by `Locale`.
2. Валидирует `ctx` против `<templateId>.context.schema.ts` (Zod). Fail-fast если поля нет.
3. Подставляет переменные через safe-escape mustache.
4. Возвращает `RenderResult` с уже sanitized HTML.

**Mandatory flag:** определяется в registry, не в template body. Hard-coded для security/billing.

---

## 5. Acceptance Criteria

| # | AC | Verification |
|---|---|---|
| AC1 | `render('login-otp', 'ru', { recipient, otp })` возвращает HTML + text с подставленным OTP, subject на русском | unit test snapshot match |
| AC2 | Все 5 templates × 2 locales = 10 pairs имеют golden snapshot files | registry-completeness test fails if missing |
| AC3 | `render()` валидирует context через Zod schema, throws ZodError при missing required field | error-path test |
| AC4 | XSS payload `<script>` в `recipient.name` HTML-escaped в output, никогда не выполняется | XSS test fixture |
| AC5 | `mandatory: true` для `login-otp` и `billing-receipt`; `false` для invite/task-complete/weekly-digest | mandatory-flag test |
| AC6 | text version всегда non-empty, не содержит HTML тегов | text-purity regex test |
| AC7 | subject ≤ 78 chars (RFC 5322 рекомендация) per template per locale | length-budget test |
| AC8 | feature flag `rox.feature.email.templates` default OFF → render() возвращает legacy plain-text fallback | flag-off test |

---

## 6. TDD план (test-first commit)

Файл первого commit-а: `tests/unit/notification/templates/*.test.ts` (failing).

1. **T1 — registry-completeness.test.ts:** проверяет, что все TemplateId × Locale имеют snapshot.
2. **T2 — render.invariants.test.ts:** safe-escape, XSS, mandatory flag.
3. **T3 — invite.snapshot.test.ts:** invite × en/ru golden snapshots.
4. **T4 — login-otp.snapshot.test.ts:** OTP rendering + 6-digit format.
5. **T5 — billing-receipt.snapshot.test.ts:** money formatting (integer cents, не float — см. CLAUDE.md `data_integrity`).
6. **T6 — task-complete.snapshot.test.ts:** task title escape + CTA URL.
7. **T7 — weekly-digest.snapshot.test.ts:** plural forms на русском (1 задача / 2 задачи / 5 задач).
8. **T8 — feature-flag.test.ts:** OFF путь возвращает legacy fallback.

Все failing на момент первого коммита. Implementation коммит делает их зелёными.

---

## 7. Файловый allowlist

```yaml
files_allowed:
  - packages/shared/src/notification/templates/**
  - packages/shared/src/notification/__tests__/**
  - packages/shared/src/notification/index.ts
  - tests/unit/notification/templates/**.test.ts
files_forbidden:
  - package.json
  - tsconfig*.json
  - packages/shared/src/i18n/**         # WT-37 owns locale extensions
  - infra/cloudflare/**                 # WT-22 territory
```

Scaffold-request к WT-00: добавить `zod` (если ещё не в shared deps) и `mustache-safe` (или
inline minimal renderer ~80 LOC чтобы избежать new dep).

---

## 8. Inspiration repos

| # | URL | Integration | Rationale |
|---|---|---|---|
| 1 | https://github.com/resend/react-email | reference_only | Type-safe email templates, JSX. Берём pattern, не JSX dep. |
| 2 | https://github.com/forwardemail/email-templates | reference_only | i18n + nodemailer integration patterns. |
| 3 | https://github.com/mjmlio/mjml | reference_only (defer) | Responsive HTML compile. Defer до WT-37. |
| 4 | https://github.com/janl/mustache.js | concept | Minimal safe-escape renderer, ~200 LOC. |
| 5 | https://github.com/lokesh-coder/pretty-cli/tree/main/packages/email | reference_only | Plain-text fallback patterns. |

---

## 9. Verification & 3-machine protocol

- **mac-14-arm:** `bun test packages/shared/src/notification` зелёный + golden snapshots stable.
- **windows-2022:** same + CRLF normalization тест (Windows email clients).
- **ubuntu-22:** same + headless render performance budget (<5ms per template).

Screenshots не требуются (no UI). Smoke test = render всех 10 pairs и diff с snapshots.

---

## 10. Linear/Featurebase sync

- **Linear parent:** PZD-115. Sub-issues: discovery / design / tests / impl / verify.
- **Featurebase board:** Compounding. Post alias: `wt-20-email-templates-i18n`.

---

## 11. Definition of Done

- [ ] TDD-first commit с 8 failing test files
- [ ] Implementation коммит — все 8 tests pass
- [ ] `bun run typecheck` зелёный
- [ ] `bun run lint` зелёный
- [ ] Golden snapshots для 5 × 2 = 10 pairs committed
- [ ] Feature flag `rox.feature.email.templates` зарегистрирован (default OFF)
- [ ] XSS test fixture passes
- [ ] 3-machine evidence files present
- [ ] Linear sub-issue Done, FB post Shipped

## 23. Mission control axes (v2 update 2026-05-21)

- **Work type:** new_module
- **CJM scenarios required:** N/A
- **UI surfaces affected:** N/A
- **Entities touched (WT-46 references):** EmailTemplate
- **Events emitted (WT-49 ActivityEvent):** template.rendered
- **AI context implications (WT-48):** N/A
- **Search index implications (WT-50):** N/A
- **12-gate artifacts required:** cjm/*.md (если cjm_scenarios), erd/entities.mmd, sequence/*.mmd, ui-inventory/*.md (если ui_surfaces), evidence/{mac,win,linux}/, observability/metrics.md
- **Heptabase parity:** N/A
- **Risk axes:** data
