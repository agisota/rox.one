# WT-01: Release pipeline + R2 mirror + CI caching

**Branch:** `feat/release-r2-on-merge`
**Base SHA:** `fac6f228069c`
**Wave:** 0
**Priority:** P0
**Feature flag:** `rox.feature.release.r2-mirror` (default OFF; включается на Foundation Cut)
**Status:** Design — awaiting implementation

---

## 1. Objective

Превратить мердж в `main` в полноценный release-event: 3-platform GitHub Actions matrix → подписанные артефакты → Cloudflare R2 mirror → Cloudflare Worker release-feed → автоматический Linear/Featurebase changelog. Снимает зависимость от GitHub Releases CDN и даёт offline-friendly self-hosted update channel.

## 2. User goal

При merge fix или feat — пользователь получает обновление через `update.rox.one` (R2-hosted feed) в течение 30 минут, без ручных шагов maintainer'а. CI кэширует bun store, electron prebuilds и playwright browsers — каждый job <8 минут.

## 3. Files allowed

- `.github/workflows/multi-platform-on-merge.yml`
- `.github/workflows/nightly-cleanup.yml`
- `.github/workflows/release-feed-update.yml`
- `.github/workflows/cache-warmer.yml`
- `scripts/release/upload-r2.ts`
- `scripts/release/sign-windows.ts`
- `scripts/release/generate-update-manifest.ts`
- `scripts/release/__tests__/upload-r2.test.ts`
- `scripts/release/__tests__/generate-update-manifest.test.ts`
- `infra/cloudflare/rox-one-release-feed.worker.ts`
- `infra/cloudflare/wrangler.toml`
- `infra/cloudflare/__tests__/release-feed.test.ts`
- `electron-builder.yml`           # owner (но с partial protection — см. files_forbidden)
- `docs/release/release-pipeline-2026-05-21.md`
- `docs/release/r2-mirror-runbook.md`
- `docs/worklog/WT-01.md`

## 4. Files forbidden

- `electron-builder.yml::rox-design-*` keys (partial-owned by WT-02)
- `apps/electron/src/**` (renderer/main code WT-02..WT-03 territory)
- `packages/**/src/**` (data-contract WT-04..WT-08)
- `package.json` (WT-00 scaffold)
- `tsconfig*.json` (WT-00 scaffold)

## 5. Depends on

WT-00 (snapshot + scaffold ownership). Никаких других — WT-01 параллелен с WT-02/03/04.

## 6. Blocks

Все downstream WT, которые требуют 3-machine verification на packaged builds: фактически — release gate каждого WT использует WT-01 workflows. Технически не блочит merge остальных, но **необходим для feature-flag turn-on** на Foundation Cut.

## 7. Functional requirements

1. **FR-01.1** Workflow `multi-platform-on-merge.yml` запускается на push в `main` (и manual dispatch) — 3 jobs matrix (`mac-14-arm`, `windows-2022`, `ubuntu-22`), каждый: bun install → typecheck → lint → build → smoke → electron-builder → artifact upload.
2. **FR-01.2** `scripts/release/upload-r2.ts` загружает артефакты в R2 bucket `rox-one-releases` с path `<version>/<platform>/<filename>`; idempotent (skip if hash matches).
3. **FR-01.3** `scripts/release/sign-windows.ts` использует Azure Trusted Signing (или, при отсутствии cert, self-signed fallback с явным флагом `--allow-self-signed`). Output: signed `.exe` + signature manifest JSON.
4. **FR-01.4** `scripts/release/generate-update-manifest.ts` производит `update.json`: `{ version, releaseDate, platforms: { mac: { url, sha512, size }, win: {...}, linux: {...} } }`; uploads to R2 path `update/<channel>/update.json`.
5. **FR-01.5** Cloudflare Worker `rox-one-release-feed` отдаёт `https://update.rox.one/<channel>/update.json` с edge-cache 60s + ETag; protected behind `rox.feature.release.r2-mirror` env switch.
6. **FR-01.6** CI cache layers: `bun-store` (key: `bun.lock` SHA), `electron-prebuilds` (key: electron version), `playwright-browsers` (key: playwright version). Cache hit rate ≥80% после warmup.
7. **FR-01.7** Workflow `nightly-cleanup.yml` (cron 02:00 UTC) — prune R2 objects > 60 days old по channel `nightly`; keep `stable` indefinitely.
8. **FR-01.8** GitHub Actions cost cap: enforce `concurrency: group=release-${{ github.ref }} cancel-in-progress=true` + `timeout-minutes: 30` per job.
9. **FR-01.9** Linear integration: при successful release publish — POST comment к PZD-119 + create sub-issue "🚀 Релиз v<x.y.z> опубликован".
10. **FR-01.10** Featurebase: auto-generate changelog draft on R2 publish (HTML body содержит download links + checksums).

## 8. Non-functional requirements

- **NFR-01.1 (perf)** End-to-end (merge → R2 available) ≤ 30 minutes p95 на 3-platform matrix.
- **NFR-01.2 (cost)** GitHub Actions monthly spend ≤ $25 (after Public repo allowance); enforce через `actions/cache-cleanup-action` + concurrency cancel.
- **NFR-01.3 (security)** Все R2 keys в GitHub Secrets, не в env-files; OIDC-аутентификация для Cloudflare API token preferred.
- **NFR-01.4 (deterministic)** SBOM CycloneDX генерируется на каждый release, attached к R2 как `<version>/sbom.json`.
- **NFR-01.5 (audit)** Workflow logs retained 90 дней; release events emit audit (`release.published`, `release.signed`, `release.uploaded`) к stdout JSON для WT-08 ingestion.
- **NFR-01.6 (rollback)** R2 bucket versioning ON; rollback = `wrangler r2 object versions get <key> --version <prev>` → re-publish update.json.

## 9. Data model touched

- **R2 object key schema:** `releases/<channel>/<version>/<platform>/<filename>` (e.g. `releases/stable/1.0.4/mac-arm64/ROX.ONE-1.0.4-arm64.dmg`).
- **Update manifest schema** (`scripts/release/update-manifest-schema.ts`):
  ```ts
  type UpdateManifest = {
    schemaVersion: 1;
    channel: 'stable' | 'beta' | 'nightly';
    version: string;          // semver
    releaseDate: string;      // ISO UTC
    platforms: Record<'mac-arm64' | 'mac-x64' | 'win-x64' | 'linux-x64', {
      url: string; sha512: string; size: number; signed: boolean;
    }>;
    sbomUrl: string;
    changelogUrl: string;
  };
  ```

## 10. API / IPC / RPC touched

- **Cloudflare Worker route:** `GET https://update.rox.one/:channel/update.json` → JSON 200 (или 503 если flag OFF).
- **Worker route:** `GET https://update.rox.one/health` → `{ status: "ok", lastUpdateUtc }`.
- **GH Actions workflow_dispatch input:** `{ channel: 'stable'|'beta'|'nightly', dry_run: bool }`.

## 11. UI/UX touched

— нет UI в этом WT. Однако `update.rox.one` consumer'ы (electron app) уже существуют и будут читать новый manifest формат через existing `electron-updater` config; backwards-compatible (старый `latest.yml` ещё генерируется параллельно 30 days).

## 12. Security / RBAC implications

- R2 bucket policy: write-only via GH OIDC; read public (для CDN).
- Worker не expose admin endpoints; cache poisoning prevention через ETag-based validation.
- Windows signing: Azure Trusted Signing identity managed by service principal, не personal cert (NFR-01.3).
- Audit emit на каждый publish (FR-01.10) — ingest в WT-08 audit store после Foundation Cut.

## 13. TDD test list

1. `describe('upload-r2', () => it('должно skip upload когда target object имеет идентичный sha512'))` — fixture: mock R2 list returning matching key, ожидать `{ skipped: true }`.
2. `describe('generate-update-manifest', () => it('должно валидировать schema strict и rejectить unknown platform'))` — fixture: input с `linux-arm64`, ожидать zod error.
3. `describe('sign-windows', () => it('должно использовать Azure cert когда AZURE_TENANT_ID present, fallback self-signed когда отсутствует и --allow-self-signed=true'))`.
4. `describe('release-feed-worker', () => it('должно возвращать 503 когда RELEASE_MIRROR_ENABLED=false'))` — Miniflare integration test.
5. `describe('release-feed-worker', () => it('должно возвращать cached response через 60s и refresh после'))`.
6. `describe('multi-platform-on-merge', () => it('должно cancel-in-progress предыдущий run на push в main'))` — мета-тест через actionlint + manual workflow_dispatch.
7. `describe('nightly-cleanup', () => it('должно prune nightly объекты старше 60 дней но не trogать stable'))`.
8. `describe('update-manifest', () => it('должно содержать sbomUrl + signed=true для всех 3 платформ при successful build'))`.

## 14. Acceptance criteria

1. **AC-01.1** Merge на main → 3-platform CI matrix успешен (mac-arm, windows-2022, ubuntu-22).
2. **AC-01.2** Артефакты загружены в R2 с deterministic path; sha512 в manifest совпадает с локально вычисленным.
3. **AC-01.3** `https://update.rox.one/stable/update.json` отдаёт valid JSON при `RELEASE_MIRROR_ENABLED=true`; 503 иначе.
4. **AC-01.4** End-to-end time (push → R2 publish) ≤ 30 минут p95 (last 10 runs).
5. **AC-01.5** CI cache hit rate ≥80% на bun-store / electron-prebuilds / playwright-browsers (validate через GH Actions cache metrics).
6. **AC-01.6** SBOM CycloneDX present на R2 для каждого release.
7. **AC-01.7** Windows binary signed: либо Azure Trusted Signing (preferred), либо self-signed с явным flag.
8. **AC-01.8** Linear sub-issue auto-created под PZD-119 на каждый release.
9. **AC-01.9** Featurebase changelog draft auto-created на каждый release.
10. **AC-01.10** Rollback procedure протестирован: 1 namespace bump на R2 → клиент откатывается на prev version.

## 15. 14-role plan

| Phase | Role | Model | Expected output |
|---|---|---|---|
| Discovery | brainstormer | opus-max | `discovery/01-vision.md` — почему R2 mirror, не GH Releases CDN |
| Discovery | requirements-keeper | opus-max | 10 AC numbered (Section 14) |
| Discovery | scope-analyzer | opus-max | List of 16 файлов + dependency на electron-builder.yml |
| Discovery | critic | opus-max | Risk: cost overrun? signing path? cache poisoning? |
| Design | prompt-writer | opus-max | `design/01-impl-plan.md` — DAG workflows + Worker arch |
| Design | architect | opus-max | `design/02-plan-review.md` — review для cache strategy |
| Impl | test-writer | opus-max | 8 failing tests + actionlint configs |
| Impl | implementer | sonnet-medium | upload-r2.ts + sign-windows.ts + manifest gen |
| Impl | super-coder | sonnet-medium | Worker + wrangler.toml + workflows |
| Impl | reviewer | opus-max | code review pass, OIDC pattern check |
| Verify | verifier | opus-max | 3-machine gates + R2 round-trip integration |
| Verify | critic | opus-max | AC matrix vs evidence |
| Verify | integrator | opus-max | merge readiness, conflict scan |
| Optimize | optimizer | opus-max | perf: parallel matrix, smaller cache keys |
| Optimize | 10x-improver | opus-max | future: code-signing certificate procurement plan |

## 16. Verification protocol

3-machine: **YES, все 3 платформы** — этот WT прямо инспектирует, что multi-platform workflow производит подписанные артефакты.

- `mac-14-arm` (GH-hosted macos-14): build `.dmg` → screenshot launch (даже self-signed beta) → smoke `electron-smoke-packaged-mac.ts` → evidence.
- `windows-2022` (GH-hosted): build `.exe` + sign → `signtool verify /pa <file>` → smoke `electron-smoke-packaged.ts` → evidence.
- `ubuntu-22` (GH-hosted): build AppImage/.deb/.rpm → smoke `electron-smoke-packaged.ts` → evidence.

Дополнительно: dry-run загрузки в R2 (preview bucket), smoke worker через `wrangler dev`.

Smoke list:
1. push tag → 3 jobs PASS
2. R2 manifest valid
3. Worker 200 + ETag cache works
4. CI cache hit ≥80% второй run

## 17. Feature flag configuration

- **Name:** `rox.feature.release.r2-mirror`
- **Default:** OFF
- **Release cut:** `foundation` (включается после полного Wave 0 merged)
- **Registry location:** `packages/shared/src/feature-flags/registry.ts` (WT-07 owns; WT-01 подаёт scaffold-extension request)
- **Worker env switch:** `RELEASE_MIRROR_ENABLED=true|false` через wrangler.toml vars.

## 18. Linear mapping

- **Parent epic:** PZD-119 (E08 — Упаковка, релиз, мульти-платформа).
- **Child stories:**
  - "🚀 Workflow multi-platform-on-merge.yml"
  - "🌐 Cloudflare Worker release-feed"
  - "📦 R2 upload tool + manifest"
  - "🔐 Windows signing pipeline"
  - "⚡ CI cache strategy (bun/electron/playwright)"
  - "🧹 Nightly cleanup workflow"
- **Existing PZD-* to attach:** issues уже созданные под PZD-119 (Release pipeline epic) — будут re-parented как sub-tasks WT-01 sub-issues после старта.

## 19. Featurebase mapping

- Board: `Enterprise, B2B` (id `6a0db1dabaed70b5d8d3f898`)
- Post alias: `wt-01-release-r2-on-merge`
- Status lifecycle: planned → in-progress → shipped
- Changelog draft (на merge): "ROX.ONE release pipeline — R2 mirror и автоподпись" — full HTML body с download links.

## 20. Inspiration repos

- `https://github.com/linear/linear-release` (E08, `direct_reuse`) — официальный Linear CLI для release tracking; используется в FR-01.9 для auto-create sub-issue.
- `https://github.com/fatedier/frp` (E08, `sidecar`) — reverse proxy для NAT-traversal; rationale для будущего headless-server distribution через R2 mirror.
- `https://github.com/mimecuvalo/all-the-things` (E08, `reference_only`) — modern web app scaffolding; референс структуры monorepo CI.
- `https://github.com/steipete/ReleaseBar` (E08, `reference_only`) — release freshness dashboard; вдохновение для будущего admin-UI с release status.

## 21. Definition of done

1. Все 8 failing tests из Section 13 → passing.
2. `bun run typecheck && bun run lint` exit 0.
3. 10 AC из Section 14 верифицированы с 3-machine evidence.
4. R2 bucket `rox-one-releases` создан + IAM policy applied.
5. Cloudflare Worker `rox-one-release-feed` deployed + DNS routed (если ETA на R2 ещё ждёт — minimal preview deployment).
6. End-to-end timing ≤30 минут p95.
7. SBOM attached к release.
8. Windows binary signed.
9. Linear PZD-119 sub-issue closed; Featurebase changelog drafted.
10. Worklog заполнен.

## 22. Open questions

| # | Question | Proposed resolution |
|---|---|---|
| 1 | Mac signing path — Apple Developer ID ($99/год) или продолжать self-signed beta? | Self-signed beta для Foundation Cut; Apple ID procurement = отдельный issue в Wave 2 (Q1 master open questions). |
| 2 | Win cert — Azure Trusted Signing ($9.99/mo) или self-signed forever? | Azure Trusted Signing активирован уже сейчас, но fallback self-signed остаётся как safety net (FR-01.3). |
| 3 | R2 bucket ETA: когда Cloudflare account activated? | Block on DevOps; временно использовать staging bucket в Cloudflare R2 dev tier; production switch в день Foundation Cut. |
| 4 | GH Actions $25/мес budget approval? | Estimate в `design/01-impl-plan.md`; запрос approval product owner до старта Phase 3. |
| 5 | `nightly` channel retention 60 дней — достаточно или 30? | 60 дней — позволяет revert на любую беспорядочную сборку из недавнего рекламного цикла; cost-wise ~15GB ×$0.015/GB-month = $0.22/мес, ничтожно. |
