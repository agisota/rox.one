# T107 - Messaging Public Risk Boundary Worklog

## 1. Task summary

Add an explicit dependency-risk policy around Lark and WhatsApp messaging
adapters so public untrusted server exposure cannot silently start SDK/worker
paths already recorded as public-production blockers in T104.

Initial state:

```text
## mac/rox-production-ready-rc...origin/mac/rox-production-ready-rc [ahead 9]
```

All existing ticket files are marked `Status: DONE`, so this follow-up is
promoted from the remaining T104 production blockers.

## 2. Repo context discovered

- `docs/release/dependency-risk-register-2026-05-08.md` records messaging
  dependency risk for `@larksuiteoapi/node-sdk`, `@whiskeysockets/baileys`,
  `protobufjs`, `axios`, and `music-metadata`.
- `packages/messaging-gateway/src/registry.ts` owns Lark and WhatsApp lifecycle
  through `saveLarkCredentials`, `tryConnectLark`, `startWhatsAppConnect`, and
  `startWhatsAppAdapter`.
- `packages/messaging-gateway/src/bootstrap.ts` is the mandatory host-facing
  construction seam for Electron and the standalone Bun server.
- `packages/server/src/index.ts` already has public-server env concepts such as
  `CRAFT_PUBLIC_APP_URL` and can pass a stricter policy into the bootstrap
  without touching Electron's private/local default.

## 3. Files inspected

- `docs/release/dependency-risk-register-2026-05-08.md`
- `docs/release/production-readiness-matrix-2026-05-06.md`
- `packages/messaging-gateway/src/bootstrap.ts`
- `packages/messaging-gateway/src/registry.ts`
- `packages/messaging-gateway/src/types.ts`
- `packages/messaging-gateway/src/__tests__/registry.test.ts`
- `packages/messaging-gateway/src/adapters/lark/index.ts`
- `packages/messaging-gateway/src/adapters/whatsapp/index.ts`
- `packages/server/src/index.ts`
- `apps/electron/src/main/index.ts`

## 4. Tests added first

Added focused registry regressions before implementation:

- `saveLarkCredentials` with `dependencyRiskMode: 'public-untrusted'` must reject
  before `globalThis.fetch` credential validation is reached.
- `startWhatsAppConnect` with `dependencyRiskMode: 'public-untrusted'` must reject
  before WhatsApp runtime state is changed or worker startup is attempted.

Red command:

```bash
bun test packages/messaging-gateway/src/__tests__/registry.test.ts
```

## 5. Expected failing test output

Initial red run before guard:

```text
10 pass
2 fail
38 expect() calls
```

Failure evidence:

- Lark expected the public-risk rejection, but got `unexpected credential validation network call`, proving credential validation reached `fetch`.
- WhatsApp expected rejection, but the promise resolved; logs included `starting WhatsApp worker` with `workerEntry: "/dev/null"`, proving worker startup was attempted.

## 6. Implementation changes

- Added `MessagingDependencyRiskMode` with modes:
  `private-local`, `public-untrusted`, `accepted-risk`, and `isolated-worker`.
- Added `dependencyRiskMode` to `MessagingGatewayRegistryOptions` and
  `MessagingBootstrapOptions`; bootstrap defaults to `private-local` to preserve
  Electron/private RC behavior.
- Added a registry guard that rejects Lark and WhatsApp in `public-untrusted`
  mode before credential validation, Lark SDK restore, WhatsApp connect, or
  WhatsApp adapter startup.
- Wired standalone Bun server config with
  `CRAFT_MESSAGING_DEPENDENCY_RISK_MODE`; when unset, `CRAFT_PUBLIC_APP_URL`
  defaults the server to `public-untrusted`, otherwise the default remains
  `private-local`.
- Fixed strict typecheck guards in `PostgresAccountStore` for
  `INSERT ... RETURNING` rows exposed by the messaging package's project
  reference typecheck.

## 7. Validation commands run

```bash
bun test packages/messaging-gateway/src/__tests__/registry.test.ts
cd packages/messaging-gateway && bun run typecheck
cd packages/server && bun run typecheck
cd packages/server-core && bun run typecheck
bun test packages/server-core/src/accounts/__tests__/postgres-store.test.ts
bun run validate:docs
git diff --check
git diff --name-only | rg '(^|/)(package\.json|bun\.lock|bun\.lockb|pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$' || true
```

## 8. Passing test output summary

Focused registry test:

```text
12 pass
0 fail
42 expect() calls
Ran 12 tests across 1 file.
```

Typecheck:

```text
packages/messaging-gateway: pass
packages/server: pass
packages/server-core: pass
```

Postgres account-store smoke:

```text
1 pass
0 fail
1 expect() calls
```

Docs and diff checks:

```text
[agent-contract] ok: 11 skills, 108 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated docs/architecture/sync-v2-design.md
git diff --check: pass
lockfile/package manifest diff check: no output
```

## 9. Build output summary

No full build expected for this bounded TypeScript lifecycle guard unless
targeted typecheck or tests show a wider impact.

## 10. Remaining risks

- This ticket adds a runtime policy guard. It does not remediate or upgrade the
  vulnerable transitive packages recorded in T104.
- Public production remains blocked until dependency remediation or signed
  accepted-risk approval plus isolation evidence and external security review.
- Remote push remains blocked in the current already-running Codex session
  because it was launched with `--yolo`; `~/.zshrc` has been corrected for the
  next session.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
|---|---|---|
| Lark public-untrusted rejection fails red before guard and passes after | Done | Red saw credential validation network call; green focused test passes |
| WhatsApp public-untrusted rejection fails red before guard and passes after | Done | Red saw worker startup attempt; green focused test passes |
| Rejections happen before network/worker startup | Done | Tests assert no Lark fetch and disconnected WhatsApp runtime |
| Private/local messaging behavior remains green | Done | Existing registry tests pass in same focused run |
| Dependency manifests and lockfiles remain unchanged | Done | Lockfile/package manifest diff check returned no output |
| Docs validation passes | Done | `bun run validate:docs` passed |
| Worklog complete | Done | This file |
| Scoped Lore commit exists | Done | This commit |
