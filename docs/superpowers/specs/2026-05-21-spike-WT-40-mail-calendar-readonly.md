# Spike WT-40: Mail/Calendar read-only research

**Branch:** `spike/mail-calendar-readonly`
**Type:** Research spike (NO merge to main, decision doc only)
**Status:** Pending research
**Time budget:** 3 days max

## 1. Objective

Определить, как ROX.ONE может получать read-only сигналы из почты и календаря пользователя (metadata + при opt-in — содержимое) для AI-контекста и source-registry, не становясь почтовым клиентом и не унаследовав storage/compliance бремя полного MUA/CalDAV-стэка. Выдать рекомендацию по провайдерам, OAuth-скоупам и contract'у `MailSource` / `CalendarSource`.

## 2. Background

В master vision (`docs/superpowers/specs/2026-05-20-rox-integration-vision-design.md`) почта и календарь обозначены как core context-источники для агентов (today-screen, day-tracking, AAP). Текущее состояние: ноль интеграций, mailbox/cal данные не доходят до агентов вообще. Существующие assumptions:

- Хранить только metadata (subject, sender, ts, thread-id, calendar event time/title) — bodies/attachments **не сохраняем** в ROX БД.
- Доступ — read-only, никаких send/modify скоупов.
- Должно встраиваться в WT-38/39 source-registry contract без отдельного pipeline.
- BYOD/personal-account и корпоративный (Workspace tenant-wide) сценарии — обе нужны.

## 3. Key questions to answer

- Q1: Какие OAuth-скоупы у Google и Microsoft Graph минимально достаточны для metadata-only (без чтения body)? Существуют ли в Graph отдельные scopes для "headers only"?
- Q2: IMAP (Fastmail, FastMail JMAP, Proton Bridge) — даёт ли metadata-only через FETCH ENVELOPE без скачивания body? Какая стоимость по latency / квотам?
- Q3: Как обрабатывать incremental sync (history/delta API в Graph, gmail `historyId`, JMAP changes) при offline-first ROX? Какова retention policy у провайдеров на delta-токены?
- Q4: Какой контракт `MailSource` / `CalendarSource` совместим с source-registry (WT-38) — pull vs push, какие события агент видит, как маркируется PII (sender-email мы храним или хэшируем)?
- Q5: Что должно быть opt-in "body access" UX-flow: per-message запрос у пользователя, scope-elevation OAuth, или локальный prompt в Composer перед расшариванием в LLM?
- Q6: Какие legal/compliance ограничения: GDPR-обработка sender email как PII, ePrivacy (особенно EU), Microsoft 365 tenant admin consent для multi-tenant приложения?
- Q7: Mailgun/SendGrid/Postmark — годятся ли как _inbound_ webhooks (forwarding alias) для пользователей без OAuth-почты? Какая privacy-стоимость передачи всей почты через сторонний relay?

## 4. Research methodology

- **Provider/library evaluation matrix** по столбцам: Provider, Auth model, Metadata-only scope?, Push/webhook?, Quota, Free tier, PII surface, Tenant-admin requirement, Verdict.
- **POC scope (≤1 день):** один read-only прототип на Google Workspace personal account — fetch последних 50 metadata writes, normalize в proposed `MailSource` contract, log latency. **POC живёт в отдельной branch `spike/mail-calendar-readonly`, не мерджится.**
- **Decision criteria:**
  1. Покрывает ≥3 из 5 mainstream сценариев (Gmail personal, Google Workspace, Microsoft 365, Fastmail, generic IMAP).
  2. Не требует tenant-admin consent для BYOD-сценария.
  3. Стоимость integration ≤2 weeks engineering на первого провайдера.
  4. Контракт расширяем без breaking change на 5+ провайдеров.
- **Time-boxed exploration:** 3 дня абсолютный максимум. День 1 — provider matrix. День 2 — POC + contract draft. День 3 — decision doc + legal/PII review.

## 5. Expected deliverables

- `docs/spikes/WT-40/decision-doc.md` — recommendation + rationale + chosen primary provider + chosen fallback.
- `docs/spikes/WT-40/provider-matrix.md` — заполненная таблица по 7+ провайдерам.
- `docs/spikes/WT-40/mock-contracts/mail-source.ts` — proposed TypeScript interface для `MailSource`/`CalendarSource` (mock, без impl).
- `docs/spikes/WT-40/oauth-scopes.md` — точные scope-строки + UX-копи для consent screen.
- (optional) POC demo branch `spike/mail-calendar-readonly` — **НЕ merge**, только для voice-over демо в Linear.

## 6. Stop conditions

- **Time budget exceeded (>3 дня):** записать то, что есть, явно выделить remaining unknowns в decision doc, поставить revisit-at дату.
- **Legal blocker:** если выяснится, что Microsoft Graph требует tenant admin consent для metadata-only — escalate в WT-44 (legal) + перевести Microsoft 365 в "Phase 2", не proceed.
- **Tech impossibility:** если ни один провайдер не даёт реальный metadata-only без body access (например, Gmail требует full read for headers) — задокументировать, предложить альтернативу (rules-based local agent, no cloud sync).
- **Privacy red line:** если единственный способ работы — long-lived refresh token с full mailbox scope, остановиться и эскалировать.

## 7. Risks

| Риск | Mitigation |
|---|---|
| Google/Microsoft могут не дать headers-only scope — body неизбежно читается | Документировать ephemeral processing pattern: fetch → extract metadata → discard body in-memory, никогда не persist. |
| Refresh-token revocation flow ломает offline-first UX | Спроектировать graceful degradation: показывать stale metadata + badge "reconnect needed". |
| Множество провайдеров → contract расходится | Зафиксировать контракт ДО POC второго провайдера, ревизия только через ADR. |
| GDPR DPA с каждым cloud-провайдером | Завести checklist DPA-требований, не интегрировать провайдера без подписанного DPA в production. |
| Tenant-admin consent блокирует enterprise sales | Параллельно подготовить Microsoft Partner Center publisher verification (выходит за рамки spike, но flag в outcome). |
| ePrivacy в EU: даже metadata sender email = PII | Зашифровать sender hash + хранить полный адрес только если user явно opt-in. |

## 8. Linear mapping

- Создать research issue (тип Research, **не Story**) под epic "Integrations Vision".
- Title: `[Spike WT-40] Mail/Calendar read-only research`.
- Status flow: Triage → In Progress → Done (when decision doc delivered + linked).
- Link: ссылка на decision doc + provider matrix в issue description.
- Estimate: 3d (research).

## 9. Featurebase mapping

- **NOT published as roadmap post** — это internal research, raw provider matrix не подходит для public.
- After decision: при положительном решении создать **vision post** на Wishlist board: "Mail & Calendar context for agents — coming Q3", без конкретных провайдеров и сроков.
- При rejection — оставить только internal ADR, на Featurebase молчать.

## 10. Outcome (filled after spike completes)

- **Decision:** _<implement | defer | reject>_
- **Primary provider:** _<Google Workspace API | Microsoft Graph | JMAP | …>_
- **If implement:** _picked up by WT-?? (Wave 4 candidate) — target start: <date>_
- **If defer:** _revisit-at: <date>, blocker: <reason>_
- **If reject:** _rationale + alternative path (e.g., local-only rule-based summarizer, no cloud mailbox sync)_
