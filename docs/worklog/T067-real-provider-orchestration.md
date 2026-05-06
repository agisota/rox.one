# T067 - Real Provider Orchestration

## 1. Task summary

Introduce a provider gateway seam for ROX ONE Workbench and Mission flows. T067
must create deterministic fake provider behavior and real-provider guardrails
without wiring real external systems into tests or UI screens.

## 2. Repo context discovered

- T066 added `@rox-agent/server-core/mission-scheduler` as the durable mission
  runtime seam.
- `packages/server-core/src/sessions/share-provider.ts` already has a
  `ShareProvider` contract, fake provider, public URL assertion, and public
  bundle secret redaction.
- `packages/server-core/src/storage/object-storage.ts` already has
  `ObjectStorageAdapter`, `InMemoryObjectStorageAdapter`, and quota service
  contracts.
- `packages/shared/src/workbench/product-mode-registry.ts` owns
  `ArtifactTypeSchema`, which is the right shared artifact type vocabulary for
  provider outputs.
- T067 should add a single gateway contract that can wrap existing provider
  seams without moving UI components onto provider-specific APIs.

## 3. Files inspected

- `packages/server-core/src/sessions/share-provider.ts`
- `packages/server-core/src/storage/object-storage.ts`
- `packages/server-core/src/mission-scheduler/durable-mission-scheduler.ts`
- `packages/shared/src/workbench/product-mode-registry.ts`
- `packages/shared/src/workbench/spec-compiler.ts`
- `packages/shared/src/workbench/validation-gates.ts`
- `docs/tickets/T064-public-share-shortlink-provider.md`
- `docs/worklog/T064-public-share-shortlink-provider.md`
- `docs/tickets/T065-production-persistence-adapter.md`
- `docs/worklog/T066-durable-mission-scheduler.md`

## 4. Tests added first

- `packages/server-core/src/provider-gateway/__tests__/provider-gateway.test.ts`
  was added before implementation to lock the provider gateway contract:
  deterministic fake artifacts, user-visible error mapping, timeout behavior
  without mutating mission state, artifact schema rejection, public-share secret
  redaction, and real-adapter blocking.
- `packages/server-core/src/provider-gateway/__tests__/provider-gateway-export.test.ts`
  was added before implementation to require a package-level export from
  `@rox-agent/server-core/provider-gateway`.

## 5. Expected failing test output

Initial red run:

```text
bun test packages/server-core/src/provider-gateway/__tests__/provider-gateway.test.ts packages/server-core/src/provider-gateway/__tests__/provider-gateway-export.test.ts
Cannot find module '../provider-gateway'
Cannot find module '@rox-agent/server-core/provider-gateway'
0 pass, 2 fail, 2 errors
```

## 6. Implementation changes

- Added `packages/server-core/src/provider-gateway/provider-gateway.ts`.
- Added `packages/server-core/src/provider-gateway/index.ts`.
- Exported `./provider-gateway` from `packages/server-core/package.json`.
- Implemented `ProviderGateway`, `ProviderAdapter`, deterministic fake gateway,
  provider capability registry, artifact/evidence output contract, and
  `ProviderGatewayError` taxonomy.
- Implemented `mapProviderErrorToUserState` for UI-safe states:
  `auth_required`, `retryable_failure`, `permanent_failure`, `timed_out`,
  `invalid_output`, and `blocked`.
- Implemented artifact normalization and validation against shared
  `ArtifactTypeSchema`.
- Implemented public payload sanitization for secret-like fields before
  provider artifacts can be used in public/share surfaces.
- Blocked `kind: "real"` adapters by default unless `allowRealProviders` is
  explicitly enabled.

## 7. Validation commands run

```text
bun test packages/server-core/src/provider-gateway/__tests__/provider-gateway.test.ts packages/server-core/src/provider-gateway/__tests__/provider-gateway-export.test.ts
bun run validate:docs
bun run typecheck:all
bun test
bun run electron:build
git diff --check
```

## 8. Passing test output summary

- Targeted provider gateway tests: `7 pass`, `0 fail`, `20 expect() calls`.
- Full test suite: `4661 pass`, `13 skip`, `0 fail`, `1 snapshots`,
  `11837 expect() calls`, `4674 tests across 390 files`.
- Docs validation: `[agent-contract] ok: 11 skills, 69 tickets, 7 required docs`
  plus architecture and sync design checks passed.
- TypeScript validation: `bun run typecheck:all` passed.
- Whitespace validation: `git diff --check` passed.

## 9. Build output summary

`bun run electron:build` passed. Existing Vite chunk-size warnings and Jotai
Babel plugin deprecation warnings remain; no T067-specific build error was
introduced.

## 10. Remaining risks

- Real external provider adapters are intentionally not implemented in this
  ticket. T067 creates the guarded contract and deterministic fake runtime seam.
- Existing provider-specific seams such as share, storage, and runtime provider
  factories are not migrated into this gateway yet; that integration belongs to
  later provider/runtime tickets.
- The gateway currently validates artifact shape and public metadata redaction;
  deeper provider-specific prompt-injection and package-trust scanning remains
  in T071.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---|---|
| Fake provider returns deterministic artifacts | PASS | `provider-gateway.test.ts` deterministic fake artifact test |
| Provider error maps to user-visible state | PASS | `ProviderGatewayError` + `mapProviderErrorToUserState` test |
| Provider timeout does not corrupt mission state | PASS | timeout test keeps input mission state unchanged |
| Provider output satisfies artifact schema | PASS | invalid artifact type rejected before evidence |
| Public/share artifacts redact secrets | PASS | public-share payload redaction test |
| Real adapters are blocked by default in tests | PASS | real email adapter is not invoked |
| Targeted tests pass | PASS | `7 pass`, `0 fail` |
| Worklog complete | PASS | This worklog includes red output, implementation, validation, risks, and matrix |
| Scoped commit exists | PASS | This scoped T067 commit |
