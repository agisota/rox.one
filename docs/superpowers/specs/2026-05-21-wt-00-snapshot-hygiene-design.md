# WT-00: Snapshot + branch hygiene + secrets rotation

**Branch:** `chore/snapshot-2026-05-21`
**Base SHA:** `fac6f228069c`
**Wave:** 0
**Priority:** P0
**Feature flag:** (нет — process WT, не feature)
**Status:** Design — awaiting implementation

---

## 1. Objective

Заморозить текущее состояние `release/v1.0.3-launch-fixes` как single source of truth `base_sha=fac6f228069c` для всех 40 WT, провести ротацию секретов и зафиксировать ownership shared scaffolds. Это process-WT: он не добавляет фичу, он создаёт **базис**, на котором запускаются все остальные worktree-ветки.

## 2. User goal

Maintainers и orchestrator получают воспроизводимую отправную точку: snapshot-документ, актуальный `bun.lock`, ротированные секреты и явный owner-map для shared scaffolds. Дальнейшие WT не дерутся за `package.json`.

## 3. Files allowed (positive globs, 5-15 файлов)

- `docs/planning/current-state-snapshot-2026-05-21.md`
- `wt-meta/scaffold-ownership.yaml`
- `wt-meta/release-cuts.yaml`
- `wt-meta/wt-00.yaml`
- `.github/CODEOWNERS`
- `package.json`
- `bun.lock`
- `tsconfig.json`
- `tsconfig.base.json`
- `AGENTS.md` (root)
- `docs/security/secrets-rotation-2026-05-21.md`
- `scripts/orchestrator/snapshot-verify.ts`
- `.gitleaks.toml`
- `.gitattributes`
- `docs/worklog/WT-00.md`

## 4. Files forbidden (negative globs)

- `apps/electron/**` (это владения WT-01..WT-03 + downstream WT)
- `packages/**/src/**` (data-contract WT владеют этим — WT-04..WT-08)
- `infra/cloudflare/**` (WT-01)
- `evidence/**` (генерируется CI, не commit'ится)
- `.orchestrator/**` (runtime state, gitignored)

## 5. Depends on

— (нет). Это корень DAG.

## 6. Blocks

WT-01, WT-02, WT-03, WT-04, WT-05, WT-06, WT-07, WT-08, WT-09 — все Wave 0 WT не могут стартовать пока snapshot не зафиксирован и scaffold-ownership не опубликован.

## 7. Functional requirements

1. **FR-00.1** Создать `docs/planning/current-state-snapshot-2026-05-21.md` со списком: текущая ветка, SHA, статус Linear PZD-112..123, статус Featurebase 5 boards, статус 16/16 preflight gates, список незакрытых HIGH issues из аудита.
2. **FR-00.2** Зафиксировать `wt-meta/scaffold-ownership.yaml`: для каждого shared file (package.json, tsconfig*, locale jsons, electron-builder.yml, AGENTS.md, .github/workflows/*, infra/cloudflare/*) указать owner-WT и список allow-listed WT, которые могут подавать scaffold-extension request.
3. **FR-00.3** Зафиксировать `wt-meta/release-cuts.yaml`: 7 cuts (Foundation/Auth/Notifications/Storage/Agent/UI/Sources) с mapping cut → feature_flag list → wave.
4. **FR-00.4** Произвести rotation секретов: GH Actions secrets (GH_TOKEN, CF_API_TOKEN, LINEAR_API_KEY, FEATUREBASE_API_KEY, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, ANTHROPIC_API_KEY), сохранить в 1Password vault `rox-one-prod`, обновить `.env.example` без значений.
5. **FR-00.5** Запустить `scripts/orchestrator/snapshot-verify.ts` — проверяет, что `git rev-parse HEAD == base_sha` , что `bun.lock` deterministic (re-run bun install → diff пустой), что gitleaks pre-commit hook активен, что все 40 entries в `wt-meta/wt-XX.yaml` валидны JSON-schema.
6. **FR-00.6** Обновить `.github/CODEOWNERS` отображая 13 эпиков → maintainers map (Section 8 master doc Q20).
7. **FR-00.7** Зафиксировать в `AGENTS.md` (root) новый раздел "Parallel Worktree Harness" с ссылкой на master design и scaffold-ownership.

## 8. Non-functional requirements

- **NFR-00.1 (security)** Все ротированные секреты с zero-overlap window: старые revoked в течение 1 часа после rotation.
- **NFR-00.2 (perf)** `snapshot-verify.ts` < 10s на M2 MacBook Air.
- **NFR-00.3 (a11y)** N/A — нет UI.
- **NFR-00.4 (i18n)** Snapshot doc RU primary + EN mirror краткий.
- **NFR-00.5 (audit)** Каждое изменение в .github/CODEOWNERS логируется через emit-audit event `codeowners.updated`.
- **NFR-00.6 (deterministic)** `bun install` → identical lockfile.

## 9. Data model touched

— нет (process-only). Однако зафиксирована **structural data**: YAML schemas:

- `scaffold-ownership.yaml`: `{ file_path: string, owner_wt: WT-XX, extension_allowed: [WT-XX], scope_notes: string }`
- `release-cuts.yaml`: `{ cut_name: string, wave: 0..3, flags: [string], precondition_wt: [WT-XX] }`

## 10. API / IPC / RPC touched

— нет.

## 11. UI/UX touched

— нет.

## 12. Security / RBAC implications

- Все секреты ротируются (NFR-00.1) — устраняет риск утечки через бывших разработчиков или скомпрометированные runners.
- `.gitleaks.toml` обязателен в pre-commit hook (предотвращает повторную утечку токенов в коммитах).
- `CODEOWNERS` исключает push в `release/*` без review epic-owner.

## 13. TDD test list (≥5 failing tests, написать FIRST)

1. `describe('snapshot-verify', () => it('должно failed когда git HEAD != base_sha'))` — fixture: чекаутить другой commit, ожидать exit 1.
2. `describe('scaffold-ownership', () => it('должно failed валидацию когда package.json owner отсутствует'))` — fixture: YAML без `package.json` entry, ожидать schema error.
3. `describe('release-cuts', () => it('должно failed когда foundation cut ссылается на flag из auth cut'))` — fixture: cyclic dependency, ожидать topological error.
4. `describe('gitleaks-hook', () => it('должно блокировать commit с фейковым AWS key pattern'))` — fixture: подложить `AKIA...` в файл, попытаться commit, ожидать non-zero exit.
5. `describe('bun-lock-determinism', () => it('должно показать пустой diff после re-install из чистого state'))` — fixture: rm node_modules; bun install; git diff bun.lock — должен быть empty.
6. `describe('codeowners-coverage', () => it('должно покрывать все 13 эпиков из epics-final.yaml'))` — parse `epics-final.yaml`, проверить, что каждый epic имеет CODEOWNERS entry.

## 14. Acceptance criteria

1. **AC-00.1** `docs/planning/current-state-snapshot-2026-05-21.md` present, содержит все 5 секций (Repo / Linear / Featurebase / Preflight / Open HIGH).
2. **AC-00.2** `wt-meta/scaffold-ownership.yaml` валиден против `wt-meta/schema/scaffold-ownership.json`.
3. **AC-00.3** `wt-meta/release-cuts.yaml` валиден; topological order проверен.
4. **AC-00.4** Все 7 секретов в 1Password обновлены; старые revoked в GH; rotation log в `docs/security/secrets-rotation-2026-05-21.md`.
5. **AC-00.5** `bun run typecheck` + `bun run lint` exit 0 на base SHA.
6. **AC-00.6** `scripts/orchestrator/snapshot-verify.ts` exit 0 локально и в CI.
7. **AC-00.7** `.github/CODEOWNERS` покрывает все 13 эпиков (test FR-00.6).
8. **AC-00.8** gitleaks pre-commit hook активирован; smoke-test с поддельным секретом блокирует commit.

## 15. 14-role plan

| Phase | Role | Model | Expected output |
|---|---|---|---|
| Discovery | brainstormer | opus-4.7-max | `discovery/01-vision.md` — почему snapshot now критичен |
| Discovery | requirements-keeper | opus-4.7-max | `discovery/02-requirements.md` — DoD + 8 AC numbered |
| Discovery | scope-analyzer | opus-4.7-max | `discovery/03-scope.md` — список 14 файлов + ownership diff |
| Discovery | critic | opus-4.7-max | `discovery/04-critique.md` — risk: missed secret? lockfile drift? |
| Design | prompt-writer | opus-4.7-max | `design/01-impl-plan.md` |
| Design | architect | opus-4.7-max | `design/02-plan-review.md` |
| Design | UX-guru | (skip — нет UI) | — |
| Impl | test-writer | opus-4.7-max | 6 failing tests (Section 13) первым commit'ом |
| Impl | implementer | sonnet-4.6-medium | snapshot doc + 2 yaml + CODEOWNERS |
| Impl | super-coder | sonnet-4.6-medium | snapshot-verify.ts |
| Impl | reviewer | opus-4.7-max | `impl/review.md` |
| Verify | verifier | opus-4.7-max | `verification/gates-report.json` |
| Verify | critic | opus-4.7-max | AC-vs-impl matrix |
| Verify | integrator | opus-4.7-max | `verification/integration-readiness.md` |
| Optimize | optimizer | opus-4.7-max | `optimization/01-perf-wins.md` (snapshot-verify <5s target) |
| Optimize | 10x-improver | opus-4.7-max | `optimization/02-future-leaps.md` (auto-rotate cron) |

## 16. Verification protocol

3-machine: **N/A для process WT** (нет packaging). Только Linux/CI:

- `ubuntu-22`: `bun run typecheck && bun run lint && bun test scripts/orchestrator/__tests__/snapshot-verify.test.ts`
- gitleaks scan: `gitleaks detect --source . --no-git`
- yaml schema check: `bunx ajv-cli validate -s wt-meta/schema/scaffold-ownership.json -d wt-meta/scaffold-ownership.yaml`

Smoke list:
1. `scripts/orchestrator/snapshot-verify.ts` exit 0
2. `gitleaks detect` no findings
3. yaml validates

## 17. Feature flag configuration

— нет. Process WT.

## 18. Linear mapping

- **Parent epic:** нет (process, без epic). Создать meta-task в "ROX.ONE GitHub Roadmap Sync" project с label `wt-process`.
- **Child stories:** "🛠 Snapshot doc 2026-05-21", "🔐 Secrets rotation 2026-05-21", "📋 Scaffold ownership map", "📋 Release cuts map", "👥 CODEOWNERS update".
- **Existing PZD-* to attach:** нет.

## 19. Featurebase mapping

- Board: `Bugs, Fixes, Improvements` (id `6a0db0b911b1b8507c8e8165`) — process changelog, не roadmap.
- Post alias: `wt-00-snapshot-hygiene-rotation` — статус Planned → Shipped after merge. Опубликовать changelog "Foundation snapshot baseline 2026-05-21" с upgrade инструкцией.

## 20. Inspiration repos

- `https://github.com/linear/linear-release` (E08, `integration_type: direct_reuse`) — паттерн auto-link GH release → Linear, переиспользуется в `snapshot-verify.ts` для проверки Linear consistency.
- `https://github.com/SecondSonConsulting/Baseline` (E08, `reference_only`) — MDM-style baseline doc как референс структуры snapshot документа.
- `https://github.com/steipete/ReleaseBar` (E08, `reference_only`) — дашборд release freshness; вдохновение для будущего snapshot-status UI (out-of-scope, но recorded в Phase 5).

## 21. Definition of done

1. Все 6 failing tests из Section 13 → passing.
2. `bun run typecheck && bun run lint && bun test` exit 0.
3. 8 AC из Section 14 верифицированы.
4. `scripts/orchestrator/snapshot-verify.ts` exit 0 в CI.
5. Master orchestrator (если уже в коде) подтверждает `wt-meta/wt-00.yaml` валиден.
6. 7 секретов ротированы + audit log present.
7. CODEOWNERS покрывает 13 эпиков.
8. Worklog `docs/worklog/WT-00.md` заполнен по AGENTS.md формату.
9. Merge done через PR, no-ff, на main.
10. Linear meta-task закрыт; Featurebase changelog published.

## 22. Open questions

| # | Question | Proposed resolution |
|---|---|---|
| 1 | CODEOWNERS map — actual maintainer GH-handles per epic? | Использовать `agisota` как fallback owner для всех 13 эпиков, пока не появятся sub-maintainers; обновить через scaffold-extension request в Wave 1. |
| 2 | Какое vault для секретов — 1Password или Vaultwarden? | 1Password (уже используется product owner'ом); audit-log в Vault → audit pipeline (E07) после WT-08. |
| 3 | Снимать `bun.lock` snapshot до или после `bun install --frozen-lockfile`? | После; зафиксировать, что determinism = re-run install не меняет lock. |

## 23. Mission control axes (v2 update 2026-05-21)

- **Work type:** process
- **CJM scenarios required:** N/A
- **UI surfaces affected:** N/A
- **Entities touched (WT-46 references):** N/A
- **Events emitted (WT-49 ActivityEvent):** N/A
- **AI context implications (WT-48):** N/A
- **Search index implications (WT-50):** N/A
- **12-gate artifacts required:** cjm/*.md (если cjm_scenarios), erd/entities.mmd, sequence/*.mmd, ui-inventory/*.md (если ui_surfaces), evidence/{mac,win,linux}/, observability/metrics.md
- **Heptabase parity:** N/A
- **Risk axes:** release
