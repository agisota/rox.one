# WT-02: ROX Design security/lifecycle hardening

**Branch:** `fix/rox-design-security`
**Base SHA:** `fac6f228069c`
**Wave:** 0
**Priority:** P0
**Feature flag:** `rox.feature.rox-design.hardening-v2` (default OFF; включается на Foundation Cut)
**Status:** Design — awaiting implementation

---

## 1. Objective

Закрыть 5 security gaps в ROX Design sidecar + embed: pin URL origin к whitelist, игнорировать `ROX_DESIGN_*` env-vars в packaged builds, bypass-resistant payload verifier, явный sidecar crash event с recovery banner, printPdf 5MB cap. Связано с findings audit 2026-05-20 PR #268 + аудит R.11 RC2.

## 2. User goal

Пользователь корпоративного клиента (E05 epic + E02 RBAC) запускает Rox Design embed, зная: (а) embed не загружает unknown origin URLs, (б) production-сборка не может быть переключена в dev-mode через env-var, (в) payload verifier ловит подмену файлов, (г) sidecar crash виден как banner с 1-click recovery, (д) PDF export ограничен 5MB и не может стать DoS vector.

## 3. Files allowed

- `apps/electron/src/main/rox-design-runtime-manager.ts`
- `apps/electron/src/main/rox-design-ipc.ts`
- `apps/electron/src/main/rox-design-fs.ts`
- `apps/electron/src/main/rox-design-view-policy.ts`
- `apps/electron/src/main/rox-design-view-manager.ts`
- `apps/electron/src/main/rox-design-desktop-bridge.ts`
- `apps/electron/src/main/rox-design-embed-skin.ts`
- `apps/electron/src/main/__tests__/rox-design-runtime-manager.test.ts`
- `apps/electron/src/main/__tests__/rox-design-ipc.test.ts`
- `apps/electron/src/main/__tests__/rox-design-view-policy.test.ts`
- `apps/electron/src/main/__tests__/rox-design-printpdf-cap.test.ts`
- `scripts/prepare-rox-design-runtime.ts`
- `scripts/check-rox-design-runtime-payload.ts`
- `scripts/__tests__/check-rox-design-runtime-payload.test.ts`
- `docs/security/rox-design-hardening-2026-05-21.md`
- `docs/worklog/WT-02.md`

## 4. Files forbidden (negative globs — для shared scaffolds + WT-03 territory)

- `electron-builder.yml` (owned by WT-01; partial-write только для `rox-design-*` keys через scaffold-extension request)
- `apps/electron/src/renderer/components/TopBar.tsx` (WT-03)
- `apps/electron/src/renderer/components/AppShell.tsx` (WT-03)
- `apps/electron/src/renderer/pages/RoxDesignPage.tsx` (WT-03)
- `apps/electron/src/renderer/contexts/NavigationContext.tsx` (WT-03)
- `apps/electron/src/main/rox-design-hotkey.ts` (WT-03 — hotkey UX)
- `packages/design-classifier/**`, `packages/design-contract/**`, `packages/design-theme-bridge/**` (используются в read-only)

## 5. Depends on

WT-00 (snapshot + scaffold ownership).

## 6. Blocks

WT-03 (TopBar) — должен использовать crash event + recovery banner emit, добавленный в WT-02 (FR-02.4). WT-33 (prompt-workspace-v2) — потребляет hardened embed.

## 7. Functional requirements

1. **FR-02.1 (URL origin pin)** `rox-design-view-policy.ts` enforces whitelist: `localhost:<port>` (dev) + `file://<bundle>/index.html` (packaged) + optional `https://design.rox.one` (enterprise). Любые другие navigation/external-resource fetches BLOCKED через `webContents.session.webRequest.onBeforeRequest`. Reject reason emit в audit event `rox-design.navigation.blocked` с url+source.
2. **FR-02.2 (env-var ignore in packaged)** `rox-design-runtime-manager.ts` reads `ROX_DESIGN_RUNTIME_PATH` / `ROX_DESIGN_DEV_MODE` / `ROX_DESIGN_PAYLOAD_HASH_OVERRIDE` ТОЛЬКО когда `app.isPackaged === false`. В packaged build — все три env переменных logged + ignored.
3. **FR-02.3 (bypass-resistant verifier)** `scripts/check-rox-design-runtime-payload.ts` валидирует payload через **double-hash**: (a) SHA-256 каждого файла в payload + (b) Merkle root всех файлов, и сравнивает оба с `payload-manifest.json` который **подписан** Ed25519 (ключ публичный в репо, приватный в GH Secrets). Bypass через подмену single file → fails Merkle. Bypass через подмену всего manifest → fails Ed25519 signature.
4. **FR-02.4 (sidecar crash event)** `rox-design-runtime-manager.ts` экспонирует `RuntimeLifecycleEvents`: `starting | ready | degraded | crashed | recovering`. Health-check WebSocket ping каждые 5s; 3 промаха подряд → `crashed`. Emit IPC event `rox-design:lifecycle` с current+previous state. Recovery: `recover()` API relaunches sidecar process, restores last session ID, re-injects skin.
5. **FR-02.5 (printPdf 5MB cap)** `rox-design-ipc.ts` `printToPDF` handler — `if (resultBuffer.byteLength > 5 * 1024 * 1024) throw new RoxDesignError('PrintPdfOverLimit', { sizeBytes, limitBytes })`. Cap configurable через `ROX_DESIGN_PRINT_PDF_MAX_BYTES` (dev-only env-var, см. FR-02.2).
6. **FR-02.6 (audit instrumentation)** Каждый из FR-02.1..02.5 emit audit event через `packages/shared/src/audit` пакет (минимальный shim — full audit pipe в WT-08). Events: `rox-design.navigation.blocked`, `rox-design.env-var.ignored`, `rox-design.payload-verifier.fail`, `rox-design.sidecar.crashed`, `rox-design.printpdf.over-limit`.
7. **FR-02.7 (feature-flag gating)** Все 5 hardenings скрыты за `rox.feature.rox-design.hardening-v2`; при OFF — legacy behaviour (но всё equally vulnerable). При ON в production — все защиты активны. Mismatch detection: гр boot-time check `if flagON && !signedManifest → log warning`.

## 8. Non-functional requirements

- **NFR-02.1 (perf)** `payload-verifier` < 200ms на cold start (50 files / 30MB total).
- **NFR-02.2 (security)** `Ed25519` keypair — private в GH Secrets, public в `apps/electron/resources/rox-design-payload-pubkey.pem`; key rotation procedure documented.
- **NFR-02.3 (a11y)** Crash banner — focusable, aria-live=assertive, keyboard recoverable через Enter.
- **NFR-02.4 (i18n)** Crash banner текст: RU + EN keys в `apps/electron/src/main/locales/{ru,en}.json` (через scaffold-extension request к WT-20).
- **NFR-02.5 (audit)** Audit events RFC 5424 severity: blocked navigation = warning, payload-verifier fail = error, sidecar crash = critical.
- **NFR-02.6 (rollback)** Feature flag OFF → embed работает как до WT-02 patch (но vulnerable); rollback через flag, не code revert.

## 9. Data model touched

- **RuntimeLifecycleState enum** (`rox-design-runtime-manager.ts`):
  ```ts
  type RuntimeLifecycleState = 'starting' | 'ready' | 'degraded' | 'crashed' | 'recovering';
  type RuntimeLifecycleEvent = {
    previous: RuntimeLifecycleState;
    current: RuntimeLifecycleState;
    transitionedAtUtc: string;
    cause?: { code: string; details: unknown };
  };
  ```
- **PayloadManifest** (`scripts/check-rox-design-runtime-payload.ts`):
  ```ts
  type PayloadManifest = {
    schemaVersion: 1;
    files: Array<{ path: string; sha256: string; sizeBytes: number }>;
    merkleRoot: string;
    signedAtUtc: string;
    signature: string;        // base64 Ed25519 signature of (merkleRoot + signedAtUtc)
  };
  ```

## 10. API / IPC / RPC touched

- **IPC event:** `rox-design:lifecycle` (main → renderer), payload `RuntimeLifecycleEvent`.
- **IPC handler:** `rox-design:recover` (renderer → main), returns `{ ok: true } | { ok: false, error }`.
- **IPC handler:** `rox-design:printPdf` — теперь throws on size>5MB.
- **Audit emit hook:** `packages/shared/src/audit/emit-audit-event.ts` — shim (full pipeline в WT-08).

## 11. UI/UX touched

— минимально. WT-02 emit'ит crash IPC event; **render** banner живёт в WT-03 (AppShell + TopBar). Здесь — только backend контракт.

## 12. Security / RBAC implications

- WT-02 — central security hardening. Все 5 FR закрывают concrete attack vectors:
  - **FR-02.1**: SSRF / external resource leak через embed
  - **FR-02.2**: Privilege escalation через env-var manipulation в installed app
  - **FR-02.3**: Code injection через payload tampering
  - **FR-02.4**: User confusion / silent crash → recovery
  - **FR-02.5**: DoS via 100MB+ PDF render
- Не вводит новых ролей; работает в context current `RoxDesignViewPolicy`.
- Audit events feed в WT-08 → eventual WT-18 query API.

## 13. TDD test list

1. `describe('rox-design-view-policy', () => it('должно блокировать navigation к https://evil.example даже когда URL приходит через subframe'))` — fixture: spawn embed → load fake child iframe → ожидать onBeforeRequest deny.
2. `describe('rox-design-runtime-manager', () => it('должно игнорировать ROX_DESIGN_DEV_MODE=1 когда app.isPackaged=true и emit audit event'))` — fixture: mock `app.isPackaged=true`, set env, ожидать ignored + audit emit.
3. `describe('check-rox-design-runtime-payload', () => it('должно failed когда single payload file modified (Merkle root mismatch)'))` — fixture: подменить 1 byte в одном файле, ожидать exit 1 с reason `merkle_mismatch`.
4. `describe('check-rox-design-runtime-payload', () => it('должно failed когда manifest signature не Ed25519-valid'))` — fixture: tamper signature byte, ожидать exit 1 с reason `signature_invalid`.
5. `describe('rox-design-lifecycle', () => it('должно transition к crashed после 3 промахов WebSocket ping + emit IPC event'))` — fake-timers, simulate 3 missed pings, ожидать current='crashed'.
6. `describe('rox-design-lifecycle', () => it('должно успешно recover() и transition crashed → recovering → ready'))`.
7. `describe('rox-design-printpdf', () => it('должно throw PrintPdfOverLimit когда buffer > 5MB'))` — fixture: mock printToPDF returns 6MB buffer.
8. `describe('rox-design-hardening-v2-flag', () => it('должно при flag=OFF восстановить legacy behaviour для всех 5 FR'))`.

## 14. Acceptance criteria

1. **AC-02.1** URL origin pin enforced — fuzz-test 20 random hostile URLs все BLOCKED.
2. **AC-02.2** `ROX_DESIGN_*` env-vars ignored в packaged build (smoke-test на signed `.dmg`/`.exe`/AppImage).
3. **AC-02.3** Payload verifier rejects 100% mutated payloads в test corpus (10 mutation strategies).
4. **AC-02.4** Sidecar crash event emitted at <200ms after 3rd missed ping; recovery completes <2s.
5. **AC-02.5** PrintPdf throws на 5MB+ buffer; error surfaced через IPC к renderer.
6. **AC-02.6** Все 5 audit events ингестятся через WT-08 shim (mock-проверка).
7. **AC-02.7** Feature flag toggle OFF — legacy behaviour 100% restored.
8. **AC-02.8** Ed25519 signature verification benchmark < 50ms на 50-file manifest.

## 15. 14-role plan

| Phase | Role | Model | Expected output |
|---|---|---|---|
| Discovery | brainstormer | opus-max | `discovery/01-vision.md` — threat model + scope |
| Discovery | requirements-keeper | opus-max | 8 AC + DoD |
| Discovery | scope-analyzer | opus-max | 16 файлов scope + diff vs PR #268 patches |
| Discovery | critic | opus-max | Threat model: missed attack vector? |
| Design | prompt-writer | opus-max | `design/01-impl-plan.md` — 7 FR breakdown |
| Design | architect | opus-max | `design/02-plan-review.md` |
| Design | UX-guru | opus-max | crash banner copy/UX (handoff to WT-03 design/03) |
| Impl | test-writer | opus-max | 8 failing tests (Section 13) — security-critical, opus-max-only |
| Impl | implementer | sonnet-medium | 7 FR implementation в 7 файлах |
| Impl | super-coder | sonnet-medium | Ed25519 sig + Merkle root impl |
| Impl | reviewer | opus-max | security-focused code review |
| Verify | verifier | opus-max | 3-machine + fuzz-test corpus |
| Verify | critic | opus-max | Attack vector matrix |
| Verify | integrator | opus-max | conflict scan vs WT-03 territory |
| Optimize | optimizer | opus-max | verifier <50ms; ping batch |
| Optimize | 10x-improver | opus-max | future: HSM-backed signing key (post-WT-08) |

## 16. Verification protocol

3-machine: **YES, все 3** — packaging path меняется через electron-builder rox-design-* keys.

- `mac-14-arm`: build `.dmg` (self-signed beta), launch, инжектировать malicious env-var → ожидать ignored + audit.
- `windows-2022`: build `.exe`, инжектировать malicious env-var → ignored.
- `ubuntu-22`: build AppImage, launch headless через xvfb, fuzz URL origin policy.

Дополнительно:
- Fuzz corpus 20 hostile URLs (mac/win/linux smoke).
- Payload mutation corpus 10 strategies (Merkle, signature, file-add, file-remove, manifest-truncate, etc.).
- WebSocket ping simulation в Vitest fake-timers.

Smoke list:
1. embed launches + recovers from forced crash
2. env-var fuzz всех 3 переменных — ignored
3. payload-verifier rejects 10 mutation cases
4. printPdf 6MB → throws
5. audit shim received 5 event types

## 17. Feature flag configuration

- **Name:** `rox.feature.rox-design.hardening-v2`
- **Default:** OFF
- **Release cut:** `foundation`
- **Registry location:** `packages/shared/src/feature-flags/registry.ts` (WT-07 owns; scaffold-extension request).

## 18. Linear mapping

- **Parent epic:** PZD-116 (E05 — Design System, Open Design embed, AAP loop).
- **Child stories:**
  - "🔒 URL origin pin + onBeforeRequest"
  - "🔒 Env-var ignore в packaged build"
  - "🔒 Payload verifier: Merkle + Ed25519"
  - "🔁 Sidecar lifecycle + crash event"
  - "🛡 PrintPdf 5MB cap"
  - "📡 Audit emit shim (5 event types)"
- **Existing PZD-* to attach:**
  - "Open Design embed: sidecar lifecycle и crash-recovery" (родитель PZD-116, existing post FB → Linear sub-issue) — re-parent под WT-02 sub-issue.
  - PR #268 audit findings #1/#3 (URL pin, env-var) — closed by WT-02.

## 19. Featurebase mapping

- Board: `Bugs, Fixes, Improvements` (id `6a0db0b911b1b8507c8e8165`) — это hardening, security fix.
- Post alias: `wt-02-rox-design-security-hardening`
- Status lifecycle: planned → in-progress → shipped
- Changelog draft (на merge): "ROX Design — security hardening v2 (URL pin, signed payload, crash recovery)" — security-focused changelog.

## 20. Inspiration repos

- `https://github.com/agisota/open-design` (E05, `ui_embedding`) — local-first альтернатива Claude Design; патерны sandboxed preview + payload pipeline прямо релевантны FR-02.3 и FR-02.5.
- `https://github.com/agisota/senpi` (E02, `partial_port`) — opinionated fork pi-mono с extension-first, IPC primitives + scope propagation; референс для `RuntimeLifecycleEvents` IPC контракта.
- `https://github.com/google-labs-code/design.md` (E05, `adapter`) — DESIGN.md spec для коммуникации design system агентам; вдохновение для `PayloadManifest` schema.
- `https://github.com/cloudflare/workerd` (general — Worker isolate sandbox patterns) — *проверить inclusion если ratified inspiration*.

## 21. Definition of done

1. Все 8 failing tests из Section 13 → passing.
2. `bun run typecheck && bun run lint && bun test apps/electron/src/main/__tests__/rox-design-*.test.ts` exit 0.
3. 8 AC из Section 14 верифицированы.
4. 3-machine evidence attached к Linear PZD-116 sub-issue.
5. Ed25519 keypair установлен; public key committed; private key в GH Secrets.
6. Audit shim emits 5 event types (mock validated).
7. Feature flag OFF — legacy behaviour 100%.
8. Worklog заполнен.
9. Linear PZD-116 sub-issues closed.
10. Featurebase changelog draft created.

## 22. Open questions

| # | Question | Proposed resolution |
|---|---|---|
| 1 | Ed25519 keypair — single global or per-channel (stable/beta/nightly)? | Single global, ротируем annually; per-channel слишком хрупко при rollback. |
| 2 | URL whitelist — captured-once или live-updateable через config? | captured-once на boot (immutable во время сессии); live-update только через релиз (минимум attack surface). |
| 3 | Crash recovery max attempts — сколько раз пробовать relaunch перед "degraded forever"? | 3 attempts с exponential backoff (500ms, 2s, 5s); далее remains crashed, user видит "Refresh app". |
| 4 | PrintPdf 5MB cap configurable per-tenant? | NO в Foundation Cut; рассмотреть в WT-07 entitlement engine (Pro/Team tier может получить 10MB). |
| 5 | Audit shim в shared package или local в apps/electron? | Local в apps/electron как minimal shim; full pipeline в WT-08 через packages/shared/src/audit/. |
