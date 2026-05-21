# WT-09 — Linear / Featurebase sync automation

**Дата:** 2026-05-21
**Статус:** Design — готов к Phase 1 (Discovery)
**Branch:** `chore/linear-fb-sync`
**Base SHA:** `fac6f228069c`
**Worktree path:** `../wt-09-linear-fb-sync`
**Parent epic:** _process_ (no epic — operational tooling)
**Wave:** 0 (Foundation)
**Priority:** P1

---

## 1. Контекст и цель

Master orchestrator (Section 6.4-6.5) предполагает, что каждый WT
синхронизирует свой жизненный цикл с Linear (PZD project) и Featurebase
(roadmap.rox.one). На сегодня sync делается ad-hoc через `.omc/sessions/`
скрипты, без detection idempotency, без redaction, без dry-run protect'а.
WT-09 даёт production-ready CLI-инструменты, которые master orchestrator
дёргает по cron каждые 15 минут.

**Цель:** одно место для всех Linear/FB операций; idempotent; dry-run
по умолчанию; полная redaction логов; никакого product-кода не трогает.

## 2. Скоуп

### 2.1 Входит

- `scripts/sync-linear.ts` — CLI: `--dry-run`, `--wt=<id>`, `--phase=<name>`,
  `--bulk`. Create/update sub-issues, attach evidence, transition status.
- `scripts/sync-featurebase.ts` — CLI: `--dry-run`, `--wt=<id>`, `--bulk`,
  `--changelog`. Roadmap post lifecycle, changelog drafts, bulk publish.
- `infra/orchestrator/linear-client.ts` — GraphQL клиент (typed, generated
  from schema or hand-written types) + retry + rate-limit + redact-on-log.
- `infra/orchestrator/featurebase-client.ts` — REST client (v2 API) +
  dedup-by-alias logic + retry.
- `infra/orchestrator/sync-state.ts` — local cache в `.orchestrator/sync-state.json`
  с timestamps + ETags, чтобы избежать re-sending.
- `infra/orchestrator/redact.ts` — shared redaction helper (re-use sanitizer
  pattern from WT-08 spec — но WT-08 ещё не merged, поэтому WT-09 имеет
  локальную копию которая будет заменена rebase'ом после WT-08 merge).
- `tests/integration/sync-linear.test.ts`,
  `tests/integration/sync-featurebase.test.ts`,
  `tests/unit/orchestrator/linear-client.test.ts`,
  `tests/unit/orchestrator/featurebase-client.test.ts`,
  `tests/unit/orchestrator/redact.test.ts`
- `wt-meta/wt-09.yaml`

### 2.2 Вне скоупа

- Master orchestrator itself (`scripts/orchestrator/master.ts`) — отдельная
  явная approval-gate работа, не в этом WT.
- Любой product-код в `apps/electron/**`, `packages/shared/**` (кроме testing
  utilities). **Strict.**
- Cloudflare Workers cron — позже, Wave 2.
- Audit/telemetry hooks (это product-side); orchestrator пишет в свой
  лог-файл с redaction.
- Bidirectional sync (FB → Linear changelog import) — отдельный WT.

### 2.3 Forbidden globs

- `apps/electron/**`
- `packages/**/src/**` (кроме `packages/shared/src/test-helpers/orchestrator-mocks.ts`)
- `package.json`, `tsconfig*.json`, `bun.lock`
- Any `.omc/sessions/**` (read-only reference; новые скрипты — здесь)

## 3. Архитектура

```
┌────────────────────────────┐         ┌──────────────────────────┐
│  scripts/sync-linear.ts    │         │ scripts/sync-featurebase │
│  (CLI entrypoint)          │         │ (CLI entrypoint)         │
└──────────┬─────────────────┘         └─────────────┬────────────┘
           │                                         │
           ▼                                         ▼
┌─────────────────────┐                ┌─────────────────────────┐
│ linear-client.ts    │                │ featurebase-client.ts   │
│  - GraphQL fetcher  │                │  - REST fetcher         │
│  - typed mutations  │                │  - dedup-by-alias       │
│  - retry+ratelimit  │                │  - retry+ratelimit      │
└──────────┬──────────┘                └────────────┬────────────┘
           │                                        │
           └─────────────┬──────────────────────────┘
                         ▼
                ┌─────────────────────┐
                │ sync-state.json     │  ←  ETag + last-seen mtime
                │ redact.ts           │  ←  shared
                └─────────────────────┘
```

**Idempotency keys:**
- Linear: `wt-id` + `phase` + `event` → mapped to Linear `clientReference`
  field (or external id custom field). Re-running same key — no-op.
- Featurebase: `post_alias` (`wt-XX-<topic>`) → resolved before any create;
  exact-match → patch, не create.

## 4. CLI surface

```bash
# Linear
bun run sync-linear --wt=WT-10 --phase=design --dry-run
bun run sync-linear --wt=WT-10 --phase=verify \
    --attach-evidence=evidence/wt-10/
bun run sync-linear --bulk --status-sweep --dry-run

# Featurebase
bun run sync-featurebase --wt=WT-10 --status=in-progress --dry-run
bun run sync-featurebase --wt=WT-10 --status=shipped --changelog-draft
bun run sync-featurebase --bulk --publish-pending-changelogs --dry-run
```

`--dry-run` — default ON, print planned mutations; explicit `--apply` для
реального вызова. Любой запуск без `--apply` НЕ делает write-операций;
любой запуск БЕЗ environment var `ROX_SYNC_TOKEN_*` падает на старте.

## 5. Архитектурные решения

- **A09-01 — Dry-run by default.** Безопаснее по умолчанию; orchestrator
  передаёт `--apply` явно.
- **A09-02 — Idempotent через alias.** Не uuid, не timestamp — alias
  читаемый и стабильный (`wt-10-access-jwt-validator`).
- **A09-03 — Secrets через env только.** `ROX_SYNC_LINEAR_TOKEN`,
  `ROX_SYNC_FEATUREBASE_TOKEN`. Никаких файлов с токенами, никаких
  hardcoded. gitleaks / trufflehog pre-commit hook добавляется в WT-00,
  но локальный `.gitignore` всё equal protect'ает `.orchestrator/`.
- **A09-04 — Redaction layered.** Все log lines идут через `redact()`
  до stdout/file. Test fixture проверяет, что включение токена в URL
  query string тоже редактится.
- **A09-05 — Rate-limit честный.** Linear `429` → exponential backoff
  до 5 minutes; Featurebase 429 → same. Никаких infinite-retry.
- **A09-06 — Sync-state cached.** Чтобы cron каждые 15 минут не fetch'ил
  всё; ETag + If-Modified-Since.

## 6. Acceptance criteria

- [ ] AC-1: `bun run sync-linear --dry-run` без `--apply` не делает ни одной
      write-mutation (verified через intercepted client)
- [ ] AC-2: Re-run одного и того же `--wt=WT-10 --phase=design --apply`
      дважды → 1-я создаёт sub-issue, 2-я — no-op (idempotent)
- [ ] AC-3: Logs не содержат `Bearer <token>` строк (verified via grep на
      test output)
- [ ] AC-4: Missing env `ROX_SYNC_LINEAR_TOKEN` → exit code 2 с
      понятным сообщением, ZERO API calls
- [ ] AC-5: Featurebase create с alias уже существующим → patch, не create
      (verified через mock returning existing-by-alias)
- [ ] AC-6: 429 response → backoff retry; ≥3 неудачных подряд → fail
      с понятной ошибкой
- [ ] AC-7: `sync-state.json` обновляется атомарно (tmp + rename), не
      повреждается при kill -9 в середине
- [ ] AC-8: Bulk mode корректно обрабатывает 40 WT за один проход без
      превышения rate-limit (≤2 req/sec)
- [ ] AC-9: redact'ит URL query, headers, body, и nested response payloads
- [ ] AC-10: Никакого `apps/electron/` или `packages/shared/src/` файла не
      изменено (pre-merge gate проверяет diff)

## 7. Тестовый план (TDD-first)

1. **`sync-linear.test.ts › dry-run mode`** — intercept fetch; assert zero
   write requests; `--apply` flips a single client method call.
2. **`linear-client.test.ts › idempotent dedup by alias`** — first create:
   mutation called; second create same alias: query+patch, не create.
3. **`redact.test.ts › no secrets in logs`** — input: URL с
   `?token=abc123…`, headers с `Authorization: Bearer xyz`, body с
   `{ "api_key": "..." }`. Output log lines должны иметь `[REDACTED]`
   везде.
4. **`featurebase-client.test.ts › dedup-by-alias`** — same alias → no
   duplicate post. Test через mock.
5. **`sync-linear.test.ts › missing token guard`** — env unset → exit 2
   до first network call.

Дополнительно: rate-limit retry + cap, atomic sync-state write,
bulk mode pacing, evidence-file attach not exceeding API max size,
graceful exit on SIGTERM in middle of bulk.

## 8. Inspiration repos

| Repo | Integration | Зачем |
|---|---|---|
| `linear/linear` (public schemas) | reference_only | GraphQL schema, тип-гены |
| `useFeatureBase/sdk-examples` | reference_only | REST API patterns |
| `safishamsi/graphify` | plugin | dedup-by-alias паттерн |
| `agentfield/agentfield` | reference_only | Agent identity для sync logs |
| `googleapis/release-please` | reference_only | Idempotent automation pattern |

## 9. Phase 5 swarm distribution

Стандартный 13-role swarm. UX-guru не задействован.

## 10. Связи

- **Зависит от:** WT-00 (scripts/, infra/orchestrator/ dir структура)
- **Блокирует:** master orchestrator (когда-нибудь начнётся); не блокирует
  product WTs — они могут merge'ить без sync (orchestrator catches up).

## 11. Verification

- Type-check + bun test на ubuntu (CLI не Electron-specific). Mac/Win
  машины — только type-check (не runtime tests; они gated по env-token
  доступности).
- Manual smoke: после impl — `bun run sync-linear --wt=WT-09 --phase=design --dry-run`
  должен напечатать понятный план и не делать запросов.

## 12. Open questions

- (O-1) Where to store `sync-state.json` — repo (gitignored) или global
  `~/.rox-orchestrator/`? Решение: repo + gitignore, проще для CI seeding.
- (O-2) Webhook back-sync (FB comment → Linear comment)? Defer to отдельный
  WT, не Wave 0.
- (O-3) Bidirectional FB ↔ Linear link enforcement (custom field) — есть
  ли существующий? Существует (см. CLAUDE.md context). Использовать его.
