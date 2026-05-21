# WT-38 — Source Registry Contract (refactor existing) — Design

**Дата:** 2026-05-21
**Статус:** Design — ready for implementation (TDD-first)
**Ветка:** `feat/source-registry-contract`
**Base SHA:** `fac6f228069c`
**Worktree path:** `../wt-38-source-registry-contract/`
**Wave:** 2
**Priority:** P0
**Depends on:** WT-04 (user contract)
**Blocks:** WT-39 (MCP connector packs)
**Parent epic:** PZD-114 (E03 Sources / MCP)
**FB board:** Compounding (`6a0db1deea7170b5d8d3f89c`)
**Feature flag:** `rox.feature.source-registry.v2` (default OFF, release cut "Sources")

---

## 1. Контекст

Существующие источники в `packages/shared/src/sources/*` (MCP, API, Local, Folder) живут как набор type-union'ов и hand-coded entries в `builtin-sources.ts`. Это:

- Дублирует поля (icon, description, scopes) в нескольких местах.
- Затрудняет добавление новых connector-packs (WT-39 заблокирован).
- Не имеет versioned contract — каждая правка ломает downstream renderer / mcp-pool clients.
- Health-check, install-url, oauth-config разбросаны по разным интерфейсам.

WT-38 рефакторит существующий код к **единому `SourceDefinition` contract** с backwards-compat shim. Никаких удалений `LoadedSource`, `McpSourceConfig`, `ApiSourceConfig` — они остаются как **derived/legacy** types. Новый канонический шейп:

```ts
interface SourceDefinition {
  id: string;                          // 'google-gmail', 'github', 'slack-messaging'
  name: string;                        // displayed
  version: string;                     // semver
  type: 'mcp' | 'api' | 'local';
  scopes: ScopeDescriptor[];
  oauth_config?: OauthConfig;
  health_check?: HealthCheckConfig;
  install_url?: string;                // for MCP packs (WT-39)
  uninstall_strategy?: 'remove' | 'archive';
  icon: { kind: 'lucide' | 'remote' | 'data-uri'; value: string };
  brand?: SourceBrand;
  capabilities: Capability[];          // ['read', 'write', 'subscribe', ...]
  audit_emit: boolean;                 // wired to WT-08
}
```

Backwards-compat shim даёт legacy callers тот же `LoadedSource` через `legacyAdapter(def)`.

## 2. Цели и нецели

### 2.1 In scope

- Объявить `SourceDefinition` в `packages/shared/src/sources/contract/`.
- Реализовать `legacyAdapter(def): LoadedSource` для backwards compat.
- Переписать `builtin-sources.ts` как массив `SourceDefinition[]`.
- Реализовать `SourceRegistry` singleton: `register(def)`, `get(id)`, `list()`, `unregister(id)`.
- Zod schema + runtime validation (поймать malformed entries на startup).
- Documentation в `docs/architecture/source-registry.md`.
- Migration map для всех текущих 12 builtin sources.
- Unit + integration тесты, гарантирующие downstream callers не сломались.

### 2.2 Out of scope

- Реальный install/uninstall flow в UI → WT-39.
- Connector-packs (MCP servers as installable packages) → WT-39.
- OAuth provider implementations → не меняем (только переупаковка config).
- Multi-tenant scoping в registry → defer (используем существующий workspace-scope).
- Renderer SourceInfoPage редизайн → defer.

## 3. Архитектура

```
packages/shared/src/sources/
  ├─ index.ts                       (re-exports — public API)
  ├─ types.ts                       (LEGACY — оставляем как derived types)
  ├─ builtin-sources.ts             (REWRITTEN — массив SourceDefinition)
  ├─ contract/
  │   ├─ source-definition.ts       (new — interface + Zod schema)
  │   ├─ scope-descriptor.ts        (new)
  │   ├─ oauth-config.ts             (new — extracted from ApiOAuthConfig)
  │   ├─ health-check.ts             (new)
  │   ├─ capability.ts               (new)
  │   └─ index.ts
  ├─ registry.ts                    (new — singleton registry)
  ├─ legacy-adapter.ts              (new — SourceDefinition → LoadedSource)
  └─ __tests__/
      ├─ registry.test.ts
      ├─ legacy-adapter.test.ts
      └─ migration-fixtures.test.ts
```

### 3.1 Ключевые файлы (files_allowed)

- `packages/shared/src/sources/contract/**`
- `packages/shared/src/sources/registry.ts`
- `packages/shared/src/sources/legacy-adapter.ts`
- `packages/shared/src/sources/builtin-sources.ts`     (rewrite)
- `packages/shared/src/sources/index.ts`               (add re-exports — append only)
- `packages/shared/src/sources/__tests__/**`
- `tests/unit/sources/registry/**`
- `tests/integration/sources/registry/**`
- `docs/architecture/source-registry.md`

### 3.2 files_forbidden

- `packages/shared/src/sources/types.ts` — STRICT no-touch (legacy callers зависят от точных типов).
- `packages/shared/src/sources/credential-manager.ts` — owned by existing OAuth subsystem.
- `packages/shared/src/sources/token-refresh-manager.ts` — owned by existing.
- `packages/shared/src/sources/api-tools.ts`, `server-builder.ts`, `storage.ts` — read-only reuse.
- `packages/shared/src/mcp/**` — owned by WT-39.
- `apps/electron/src/renderer/pages/SourceInfoPage.tsx` — owned by renderer team (read-only consumer).
- `package.json`, `tsconfig*.json`, `bun.lock`.

### 3.3 Scaffold-extension requests

- WT-07: register flag `rox.feature.source-registry.v2` в `feature-flags.ts`.
- WT-00: confirm `zod@^3.23.0` уже в deps (no add if present, иначе add).

## 4. TDD план (≥ 5 tests-first)

| # | Test name | What it asserts |
|---|---|---|
| T1 | `SourceDefinition Zod schema accepts valid builtin entries` | Все 12 текущих builtin sources проходят `SourceDefinitionSchema.parse()` после migration. |
| T2 | `Zod rejects malformed definition (missing id)` | `parse({ name: 'x' })` → throws с понятным path-error. |
| T3 | `registry.register adds and registry.get returns by id` | Register def → `registry.get('google-gmail')` возвращает same object. |
| T4 | `registry.register rejects duplicate id` | Second register с тем же id → `Result.err({ code: 'DUPLICATE_ID' })`. |
| T5 | `legacyAdapter(def) produces shape compatible with LoadedSource` | Type-level check + runtime: existing consumer (e.g. `isOAuthSource`) работает. |
| T6 | `builtin-sources.ts loads 12 known sources at startup` | `registry.list().map(s => s.id)` содержит все известные ID без потерь. |
| T7 | `feature flag OFF — registry returns empty list AND legacy callers reuse old static array` | При `rox.feature.source-registry.v2=false` — old code path активен; downstream tests existing pass. |
| T8 | `audit_emit flag triggers emit on register/unregister` | Mock audit emitter; register → 1 call с `sources.registry.register`. |
| T9 | `migration fixtures: each legacy LoadedSource has 1:1 SourceDefinition mapping` | Snapshot test для всех 12 sources: `def -> legacyAdapter(def) -> LoadedSource` идентично существующему hard-coded entry. |
| T10 | `registry.unregister removes and subsequent get returns undefined` | After unregister, `get(id)` returns undefined; audit event emitted. |

Все тесты commit-ятся первым коммитом `test(sources): failing tests for SourceDefinition contract` ДО любого impl-кода.

## 5. Acceptance Criteria (≥ 5)

1. **AC-1:** `SourceDefinition` interface + Zod schema объявлены в `packages/shared/src/sources/contract/source-definition.ts`; все поля документированы JSDoc-ами; semver `version` валидируется regex.
2. **AC-2:** `SourceRegistry` singleton имеет API `register / get / list / unregister`; thread-safe (single mutation queue); audit-emit на каждую mutation.
3. **AC-3:** `legacyAdapter(def): LoadedSource` сохраняет 100% legacy callers — `git grep "LoadedSource"` тесты continue green без изменений в downstream коде.
4. **AC-4:** Все 12 текущих builtin sources переписаны в декларативном виде; migration snapshot tests доказывают bit-for-bit identity legacy-shape.
5. **AC-5:** Feature flag OFF → legacy static array остаётся primary; новый registry empty. Один git-grep на runtime path подтверждает no-op.
6. **AC-6:** Documentation `docs/architecture/source-registry.md` объясняет: contract, migration, backwards compat, отношение к WT-39.
7. **AC-7:** No breaking changes — `bun test packages/shared/src/sources/__tests__/` (existing tests до WT-38) проходит без правки.
8. **AC-8:** Type-coverage: zero `any` в new contract files; `noImplicitAny: true` соблюдён.

## 6. Risks

| Risk | Mitigation |
|---|---|
| Subtle shape drift между legacy и new | Snapshot tests + property-based `def → adapter → def'` round-trip. |
| Existing renderer падает на startup из-за timing | Lazy init registry; legacy path остаётся пока flag OFF. |
| Zod validation overhead на startup | Parse только в dev/test; в prod — typed cast (с runtime sanity check на critical fields). |
| Версионирование (semver) entries не согласовано | Single static `INITIAL_VERSION = '1.0.0'` для всех migrated sources. |
| Conflict с WT-39 — кто owns registry shape | WT-38 owns contract; WT-39 потребитель + добавляет MCP-pack-specific fields через `extends`. |
| Audit storm если много sources | Coalesce audit per startup batch (single `sources.registry.bulk-register`). |

## 7. Inspiration repos

1. `colinhacks/zod` — runtime schema validation (dependency).
2. `modelcontextprotocol/servers` — MCP server-as-pack pattern для inspiration WT-39 boundary (reference_only).
3. `cline/cline` — provider registry pattern в VS Code extension (reference_only, Apache-2.0).
4. `composio-dev/composio` — connector registry с versioned definitions (reference_only).
5. `langchain-ai/langchainjs` — tool registry abstractions (reference_only, MIT).

## 8. Verification protocol

- **Unit:** `bun test packages/shared/src/sources/__tests__/` — both legacy и new test suites.
- **Integration:** `bun test tests/integration/sources/registry/` — startup flow, flag toggle, audit emit.
- **3-machine:** typecheck + tests на mac/win/linux; UI не затронут, screenshots не требуются.
- **Backwards compat sweep:** `bun run typecheck` на packages/shared/src/sources consumers без правки — exit 0.

## 9. Definition of Done

- [x] Tests-first commit precedes any impl commit.
- [x] `bun run typecheck` exit 0 (zero new errors anywhere в monorepo).
- [x] `bun run lint` exit 0.
- [x] `bun test packages/shared/src/sources/` + integration exit 0 (≥10 tests).
- [x] Migration snapshot tests green для всех 12 builtin sources.
- [x] No regressions: existing source tests pass без правки.
- [x] Documentation `docs/architecture/source-registry.md` создан.
- [x] Feature flag OFF: registry empty, legacy path активен.
- [x] Type-coverage: zero `any` в new files.
- [x] Linear PZD sub-issue moved to "Ready for Merge".

## 23. Mission control axes (v2 update 2026-05-21)

- **Work type:** refactor
- **CJM scenarios required:** N/A
- **UI surfaces affected:** N/A
- **Entities touched (WT-46 references):** SourceDefinition
- **Events emitted (WT-49 ActivityEvent):** source.registered
- **AI context implications (WT-48):** N/A
- **Search index implications (WT-50):** N/A
- **12-gate artifacts required:** cjm/*.md (если cjm_scenarios), erd/entities.mmd, sequence/*.mmd, ui-inventory/*.md (если ui_surfaces), evidence/{mac,win,linux}/, observability/metrics.md
- **Heptabase parity:** N/A
- **Risk axes:** data
