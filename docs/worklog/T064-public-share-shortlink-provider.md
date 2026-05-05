# T064 - Public Share Shortlink Provider Worklog

## 1. Task summary

Introduce a testable public share provider seam for session sharing and protect public payloads/shortlinks before metadata is persisted.

## 2. Repo context discovered

- `SessionManager.shareToViewer()` posts `storedSession` directly to `${VIEWER_URL}/s/api`.
- `SessionManager.updateShare()` PUTs directly to `${VIEWER_URL}/s/api/${sharedId}`.
- `SessionManager.revokeShare()` DELETEs directly from the viewer endpoint.
- `packages/server-core/src/sessions/share-errors.ts` maps viewer HTTP failures into actionable `ShareResult` errors.
- Renderer share buttons already call `shareToViewer`, `updateShare`, and `revokeShare` via session commands.

## 3. Files inspected

- `packages/server-core/src/sessions/SessionManager.ts`
- `packages/server-core/src/sessions/share-errors.ts`
- `packages/server-core/src/sessions/share-errors.test.ts`
- `packages/shared/src/protocol/dto.ts`
- `apps/electron/src/renderer/components/app-shell/SessionMenu.tsx`
- `apps/electron/src/renderer/components/app-shell/SessionMenuParts.tsx`
- `apps/electron/src/renderer/pages/ChatPage.tsx`
- `packages/shared/src/branding.ts`

## 4. Tests added first

- `packages/server-core/src/sessions/share-provider.test.ts`
  - fake provider upload/shortlink contract
  - recursive public payload sanitizer
  - public HTTPS shortlink guard
  - viewer HTTP failure mapping
- `packages/server-core/src/sessions/session-share-provider.test.ts`
  - `SessionManager.shareToViewer()` persists metadata only after upload and shortlink creation succeed
  - share failures do not mutate stored session metadata
  - update and revoke use the share provider seam
  - uploaded bundles do not leak auth/session fields

## 5. Expected failing test output

Initial red command:

```bash
bun test packages/server-core/src/sessions/share-provider.test.ts packages/server-core/src/sessions/session-share-provider.test.ts
```

Expected failure before implementation:

```text
Cannot find module './share-provider'
0 pass
2 fail
2 errors
```

## 6. Implementation changes

- Added `packages/server-core/src/sessions/share-provider.ts` with:
  - `ShareProvider` interface for `uploadBundle`, `createShortlink`, `updateBundle`, `getShareStatus`, and `revokeShare`.
  - default viewer-backed provider that preserves the existing `/s/api` viewer contract.
  - deterministic fake share provider for tests.
  - recursive sanitizer for public share bundles.
  - HTTPS/public-host validation before accepting shortlink URLs.
  - provider failure mapping back into the existing `ShareResult` protocol.
- Updated `packages/server-core/src/sessions/SessionManager.ts` so share/update/revoke/delete paths use the provider seam instead of direct viewer `fetch` calls.
- Updated `packages/shared/src/protocol/dto.ts` with additional share error codes for expired links, invalid public URLs, and secret leak detection.
- Added `docs/tickets/T064-public-share-shortlink-provider.md` as the canonical ticket.

## 7. Validation commands run

```bash
bun test packages/server-core/src/sessions/share-provider.test.ts packages/server-core/src/sessions/session-share-provider.test.ts
bun test packages/server-core/src/sessions/share-errors.test.ts packages/server-core/src/sessions/share-provider.test.ts packages/server-core/src/sessions/session-share-provider.test.ts
bun run validate:docs
bun run typecheck:all
bun test
bun run electron:build
bun run e2e:core
git diff --check
```

## 8. Passing test output summary

- Targeted T064 tests: `7 pass`, `0 fail`, `28 expect() calls`.
- Targeted share regression set: `10 pass`, `0 fail`, `32 expect() calls`.
- Docs validation: agent contract, architecture docs, sync-v2 design, snapshot, and plan validation passed.
- Typecheck: `bun run typecheck:all` passed.
- Full test suite: `4640 pass`, `13 skip`, `0 fail`, `1 snapshots`, `11752 expect() calls`, `4653 tests across 385 files`.
- Core E2E: all core scenarios passed.

## 9. Build output summary

- `bun run electron:build` passed.
- Renderer build completed with existing Vite chunk-size warnings for large bundles.
- SDK resource staging verified `claude-agent-sdk-darwin-arm64` as a `claude-agent-sdk-binary` alias.
- `bun run e2e:core` also rebuilt Electron and passed headless startup smoke.

## 10. Remaining risks

- The default provider still depends on the existing remote viewer backend being reachable and accepting the current API contract.
- No production shortlink backend was added in this ticket; this ticket adds the contract, validation seam, fake provider tests, and safer viewer integration.
- Renderer share UI still uses the existing toast/menu surfaces; richer retry/progress states can be refined in a later UX ticket without bypassing the provider seam.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
|---|---|---|
| Provider contract covered by tests | DONE | `share-provider.test.ts` |
| Payload sanitizer removes secret/auth fields | DONE | `sanitizeShareBundleForPublicViewer` regression test |
| Local/non-public shortlinks rejected | DONE | `assertPublicShareUrl` regression test |
| Share metadata persisted only after success | DONE | `session-share-provider.test.ts` |
| Update/revoke use provider seam | DONE | `session-share-provider.test.ts` |
| Actionable failures preserved | DONE | `share-errors.test.ts` and provider failure mapping tests |
| Validation passes | DONE | Targeted tests, full `bun test`, docs, typecheck, build, and E2E passed |
| Worklog complete | DONE | This file |
| Scoped commit created | DONE | T064 scoped Lore commit |
