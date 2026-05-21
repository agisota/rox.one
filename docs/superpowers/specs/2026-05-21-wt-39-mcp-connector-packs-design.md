# WT-39 — MCP Connector Packs (install / uninstall flow) — Design

**Дата:** 2026-05-21
**Статус:** Design — ready for implementation (TDD-first)
**Ветка:** `feat/mcp-connector-packs`
**Base SHA:** `fac6f228069c`
**Worktree path:** `../wt-39-mcp-connector-packs/`
**Wave:** 2
**Priority:** P0
**Depends on:** WT-38 (SourceDefinition contract)
**Blocks:** —
**Parent epic:** PZD-114 (E03 Sources / MCP)
**FB board:** Compounding (`6a0db1deea7170b5d8d3f89c`)
**Feature flag:** `rox.feature.mcp-packs` (default OFF, release cut "Sources")

---

## 1. Контекст

После того как WT-38 объявил единый `SourceDefinition` contract, открывается возможность поставлять MCP-серверы как **packs** — версионированные, подписанные, устанавливаемые из marketplace UI. Сейчас MCP-источники регистрируются через hard-coded entries и `~/.rox/workspaces/{ws}/sources/`. Никакого install/uninstall flow, никакого discovery, никакой signature verification.

WT-39 строит:

1. **Pack definitions** в `packages/shared/src/mcp/packs/*` — статические манифесты для нескольких curated MCP-серверов (filesystem, git, sqlite, github, fetch).
2. **Marketplace UI** в `apps/electron/src/renderer/pages/sources/marketplace/*` — список доступных pack'ов, install/uninstall кнопки, статус.
3. **Install flow:** download (или local copy) → verify signature → register в SourceRegistry → enable.
4. **Uninstall flow:** disable → unregister → cleanup files (archive vs remove согласно `uninstall_strategy`).

Поддержка remote-pack URL (HTTP) — opt-in только в dev profile; production v1 = curated locally-shipped pack'и.

## 2. Цели и нецели

### 2.1 In scope

- `McpPackManifest` schema (extends `SourceDefinition`): `pack_id`, `bundle_url`, `signature`, `entry_point`, `permissions`.
- Pack definitions для 5 curated серверов: `filesystem`, `git`, `sqlite`, `github`, `fetch`.
- Marketplace page: список, search/filter, status badges (installed / available / failed), install/uninstall кнопки.
- Install flow в main: download → verify signature (ed25519 via `@noble/ed25519`) → register → enable.
- Uninstall flow: confirmation dialog → disable → unregister → cleanup per `uninstall_strategy`.
- Audit events: `mcp.pack.install.started/succeeded/failed`, `mcp.pack.uninstall.*`.
- i18n RU/EN.

### 2.2 Out of scope

- Pack publishing / submission flow (third-party authors).
- Remote pack discovery API (live registry server) — defer.
- Pack auto-update механизм.
- Sandbox isolation (Docker / firejail) — используем existing MCP transport (stdio/http).
- Inter-tenant pack permissions — entitlement gate через WT-07.
- WhatsApp/Baileys-like грey-area packs (legal audit blocker — out of cycle).

## 3. Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│ Renderer: apps/electron/src/renderer/pages/sources/marketplace/ │
│  ├─ MarketplacePage.tsx                                          │
│  ├─ PackCard.tsx          — single pack with install button     │
│  ├─ PackDetailsModal.tsx  — scopes, permissions, signature info │
│  └─ InstallProgressToast.tsx                                     │
└──────────────────────┬───────────────────────────────────────────┘
                       │ IPC: mcp-packs:*
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ Main: apps/electron/src/main/mcp-packs/                          │
│  ├─ pack-installer.ts     — download → verify → register        │
│  ├─ pack-uninstaller.ts   — unregister → cleanup                │
│  ├─ signature-verifier.ts — ed25519 verification                │
│  └─ pack-loader.ts        — load curated locally-shipped packs  │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ Shared: packages/shared/src/mcp/packs/                          │
│  ├─ manifest-schema.ts   (Zod schema extends SourceDefinition)  │
│  ├─ curated/                                                     │
│  │   ├─ filesystem.pack.json                                     │
│  │   ├─ git.pack.json                                            │
│  │   ├─ sqlite.pack.json                                         │
│  │   ├─ github.pack.json                                         │
│  │   └─ fetch.pack.json                                          │
│  └─ keys/                                                        │
│      └─ rox-pack-signing.pub                                     │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
   Install target:
     ~/.rox/mcp-packs/{packId}/{version}/
        ├─ manifest.json      (canonical)
        ├─ bundle/             (server files)
        └─ .installed.json     (timestamp, signature_kid)
```

### 3.1 Ключевые файлы (files_allowed)

- `apps/electron/src/renderer/pages/sources/marketplace/**`
- `apps/electron/src/main/mcp-packs/**`
- `apps/electron/src/main/ipc/mcp-packs-handlers.ts`
- `packages/shared/src/mcp/packs/**`
- `tests/unit/mcp-packs/**`
- `tests/integration/mcp-packs/**`
- `apps/electron/src/main/locales/en.mcp-packs.json`
- `apps/electron/src/main/locales/ru.mcp-packs.json`

### 3.2 files_forbidden

- `packages/shared/src/sources/contract/**` — owned by WT-38 (read-only).
- `packages/shared/src/sources/registry.ts` — owned by WT-38 (consume API only).
- `packages/shared/src/mcp/client.ts`, `mcp-pool.ts`, `pool-server.ts` — read-only reuse.
- `package.json`, `tsconfig*.json`, `bun.lock` — scaffold к WT-00.
- `packages/shared/src/feature-flags.ts` — owned by WT-07.

### 3.3 Scaffold-extension requests

- WT-00: add `@noble/ed25519@^2.1.0` для signature verification.
- WT-07: register flag `rox.feature.mcp-packs` + entitlement check `pro.mcp-packs` (Pro/Team only).
- WT-38: expose `SourceRegistry.register/unregister` public; add `McpPackExtension` type extends `SourceDefinition`.

## 4. TDD план (≥ 5 tests-first)

| # | Test name | What it asserts |
|---|---|---|
| T1 | `loads curated pack manifests from disk and validates against schema` | Все 5 curated `.pack.json` проходят `McpPackManifestSchema.parse()`. |
| T2 | `install flow: verify signature → register → enable returns ok` | Mock signature ok + mock SourceRegistry → result `{ ok: true }`; registry.register called once. |
| T3 | `install fails closed on signature mismatch` | Tampered manifest → `Result.err({ code: 'SIGNATURE_INVALID' })`; registry untouched. |
| T4 | `uninstall flow disables + unregisters + cleans files` | After uninstall — registry.get(id) returns undefined; files moved to archive (per strategy). |
| T5 | `install/uninstall emit audit events with sanitized fields` | Audit emitter called с `{ type: 'mcp.pack.install.succeeded', pack_id, version, kid_hash }` без raw bundle. |
| T6 | `feature flag OFF hides marketplace + IPC returns FEATURE_DISABLED` | При `rox.feature.mcp-packs=false` — Marketplace page не показывается; IPC `mcp-packs:install` отвечает ошибкой. |
| T7 | `entitlement gate blocks install for Free tier and surfaces upgrade hint` | Mock `useEntitlement('pro.mcp-packs')=false` → install button disabled + ContextualHint (WT-37) anchor. |
| T8 | `concurrent install of same pack is serialized` | Two install calls in flight → second получает `IN_PROGRESS` или ждёт; never double-register. |
| T9 | `uninstall confirmation dialog enforces user action` | Auto-confirm только в test mode; production требует click. |
| T10 | `installed packs survive renderer restart and appear in registry on boot` | After install + IPC reset → pack-loader rehydrates registry; `list()` содержит installed pack. |

Все тесты commit-ятся первым коммитом `test(mcp-packs): failing tests for install/uninstall flow` ДО любого impl-кода.

## 5. Acceptance Criteria (≥ 5)

1. **AC-1:** Pack manifest extends `SourceDefinition` (WT-38) и проходит Zod validation; добавляет `pack_id`, `bundle_url`, `signature`, `entry_point`, `permissions`.
2. **AC-2:** Curated 5 packs (filesystem, git, sqlite, github, fetch) поставляются в bundle; их manifests подписаны rox-pack-signing key и проходят verification на startup.
3. **AC-3:** Install flow атомарен: либо все 4 шага (download → verify → register → enable) успешны, либо registry/files остаются в исходном состоянии (rollback on failure).
4. **AC-4:** Uninstall flow honors `uninstall_strategy`: `archive` → move в `.archive/`; `remove` → delete bundle. Registry всегда unregister'ит.
5. **AC-5:** Entitlement gate `pro.mcp-packs` (Pro/Team tier) — Free tenants видят marketplace в read-only mode с upgrade hint (использует WT-37 `ContextualHint`).
6. **AC-6:** Audit events эмитятся для install/uninstall lifecycle; bundle bytes никогда не попадают в audit/logs (only hashes).
7. **AC-7:** Feature flag OFF → marketplace UI скрыт, IPC handlers возвращают `FEATURE_DISABLED`, pack-loader не активен.
8. **AC-8:** Concurrency: per-pack install/uninstall serialized через mutex (`Map<packId, Promise>`); double-click не вызывает гонок.
9. **AC-9:** UX-guru wireframe для MarketplacePage + PackDetailsModal ratified в Linear (PM signoff).

## 6. Risks

| Risk | Mitigation |
|---|---|
| Signature verification key compromise | Multi-key support в schema (`signatures: [{kid, value}]`); rotation plan в docs. |
| Pack bundle malicious behavior | Curated v1 only; sandbox spike → WT-44/future research. |
| Disk space exhaustion после множества install | Per-tenant quota gate (reuses WT-24 quota engine when avail). |
| Install partial failure leaves dirty state | Two-phase commit: stage to `.staging/`, atomic rename, rollback on failure. |
| Conflict с WT-38 registry mutation order | All registry calls go through single coordinator queue. |
| Locale drift on pack metadata (RU/EN) | Manifest содержит `name_localized: { en, ru }`; renderer picks current locale. |
| Legal grey area (sketchy packs) | Curated whitelist v1; no remote install в production. |

## 7. Inspiration repos

1. `modelcontextprotocol/servers` — canonical MCP server examples (reference_only).
2. `paulmillr/noble-ed25519` — signature verification (dependency).
3. `vscode-extensions/vscode-marketplace` — marketplace UX patterns (reference_only).
4. `astral-sh/uv` — packed binary install/uninstall lifecycle (reference_only, Apache-2.0).
5. `pkgxdev/pkgx` — manifest-driven package installation (reference_only).

## 8. Verification protocol

- **Unit:** `bun test tests/unit/mcp-packs/` — 10 tests above.
- **Integration:** `bun test tests/integration/mcp-packs/` — full install/uninstall round-trip с file-system fixture.
- **3-machine:** screenshot Marketplace page + install progress на mac-14-arm, windows-2022, ubuntu-22.
- **Smoke:** `mcp-packs-install-filesystem-pack` E2E (open marketplace → install → verify in source list).
- **Security:** signature tamper test + rollback test обязательны.

## 9. Definition of Done

- [x] Tests-first commit precedes any impl commit.
- [x] `bun run typecheck` exit 0.
- [x] `bun run lint` exit 0.
- [x] `bun test tests/unit/mcp-packs/` + integration exit 0 (≥10 tests).
- [x] Signature verification path covered (positive + tamper).
- [x] Atomic install rollback verified by chaos test.
- [x] Feature flag OFF: zero marketplace UI, zero IPC, zero pack-loader.
- [x] Screenshots marketplace + install state на 3 OS приложены в evidence/wt-39/.
- [x] Bundle budget renderer increase ≤ 80 KB.
- [x] Locales RU/EN — 100% coverage.
- [x] UX-guru wireframe ratified в Linear PZD comment.
- [x] Linear PZD sub-issue moved to "Ready for Merge".

## 23. Mission control axes (v2 update 2026-05-21)

- **Work type:** new_module
- **CJM scenarios required:** install-mcp-pack
- **UI surfaces affected:** MCPMarketplace
- **Entities touched (WT-46 references):** MCPPack
- **Events emitted (WT-49 ActivityEvent):** pack.installed, pack.uninstalled
- **AI context implications (WT-48):** N/A
- **Search index implications (WT-50):** index
- **12-gate artifacts required:** cjm/*.md (если cjm_scenarios), erd/entities.mmd, sequence/*.mmd, ui-inventory/*.md (если ui_surfaces), evidence/{mac,win,linux}/, observability/metrics.md
- **Heptabase parity:** N/A
- **Risk axes:** security, data
