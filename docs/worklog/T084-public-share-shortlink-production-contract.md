# T084 - Public Share / Shortlink Production Contract Worklog

## 1. Task summary

Complete the RC public share contract by adding explicit status verification and
renderer-safe share UI state mapping on top of the existing provider seam.

## 2. Repo context discovered

- T064 already introduced `ShareProvider`, deterministic fake provider,
  sanitizer, public URL guard, and `SessionManager` upload/update/revoke
  integration.
- T071 already hardened public payload redaction for secret-looking embedded
  values.
- `SessionManager` exposes `shareToViewer`, `updateShare`, and `revokeShare`
  through the session command handler.
- There is no session command for `getShareStatus`.
- Renderer share menu calls session commands directly and maps failures to
  toasts, but it does not have a typed production share flow state model.

## 3. Files inspected

- `docs/tickets/T064-public-share-shortlink-provider.md`
- `docs/worklog/T064-public-share-shortlink-provider.md`
- `packages/server-core/src/sessions/share-provider.ts`
- `packages/server-core/src/sessions/share-provider.test.ts`
- `packages/server-core/src/sessions/session-share-provider.test.ts`
- `packages/server-core/src/sessions/SessionManager.ts`
- `packages/server-core/src/handlers/rpc/sessions.ts`
- `packages/shared/src/protocol/dto.ts`
- `apps/electron/src/shared/types.ts`
- `apps/electron/src/renderer/components/app-shell/SessionMenu.tsx`
- `apps/electron/src/renderer/components/app-shell/SessionMenuParts.tsx`

## 4. Tests added first

- `packages/server-core/src/sessions/share-provider.test.ts`
  - fake provider reports `active` and `revoked` status deterministically.
- `packages/server-core/src/sessions/session-share-provider.test.ts`
  - `SessionManager.getShareStatus()` queries through provider seam without
    mutating persisted share metadata.
- `apps/electron/src/renderer/components/app-shell/__tests__/session-share-flow.test.ts`
  - share failures map to `auth_required`, `failed_retryable`, and
    `failed_permanent`.
  - provider lifecycle status maps to `copied` and `revoked`.
  - create flow emits `preparing -> uploading -> creating_link -> copied`.
  - retryable failures can retry.
  - revoke success enters `revoked`.

## 5. Expected failing test output

Initial red command:

```bash
bun test packages/server-core/src/sessions/share-provider.test.ts packages/server-core/src/sessions/session-share-provider.test.ts apps/electron/src/renderer/components/app-shell/__tests__/session-share-flow.test.ts
```

Expected failures before implementation:

```text
fake provider reports active and revoked share status deterministically
Expected status "revoked", received "active"

SessionManager share provider integration > queries share status through the provider seam
TypeError: sm.getShareStatus is not a function

Cannot find module '../session-share-flow'
```

## 6. Implementation changes

- Added shared protocol `PublicShareStatusResult` and `getShareStatus` session
  command.
- Added `SessionManager.getShareStatus()` and routed the RPC session command to
  the provider seam.
- Extended `ISessionManager` with the status method so handler typing stays
  honest.
- Updated deterministic fake share provider to track active/revoked lifecycle
  status.
- Added renderer `session-share-flow.ts` state controller and failure/status
  mapping.
- Wired share creation to the renderer state controller so the menu shows
  preparing/uploading/creating-link/copied/failure feedback states.
- Reused the same failure mapper for update/revoke toast descriptions.

## 7. Validation commands run

```bash
bun test packages/server-core/src/sessions/share-provider.test.ts packages/server-core/src/sessions/session-share-provider.test.ts apps/electron/src/renderer/components/app-shell/__tests__/session-share-flow.test.ts
bun run typecheck:all
bun run validate:docs
bun run lint
bun run electron:build
git diff --check
```

## 8. Passing test output summary

- Targeted T084 tests: `15 pass`, `0 fail`, `57 expect() calls`.
- Typecheck: `bun run typecheck:all` passed after adding the shared protocol and
  session manager interface entries.
- Docs validation: passed; agent contract reported `85 tickets`.
- Lint: passed with the existing three React hook dependency warnings in
  `App.tsx` and `FreeFormInput.tsx`.
- `git diff --check`: passed.

## 9. Build output summary

- `bun run electron:build` passed.
- Renderer build completed with existing chunk-size warnings.
- SDK resource staging verified `claude-agent-sdk-darwin-arm64` as
  `claude-agent-sdk-binary`.

## 10. Remaining risks

- Production shortlink backend reachability remains outside fake-provider tests.
- Full renderer click-through is covered later by RC E2E/manual validation.
- The share UI now has explicit feedback states, but no full browser-driven menu
  interaction was added in this ticket.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
|---|---|---|
| ShareProvider exposes upload/shortlink/status/revoke | Pass | Existing provider plus T084 status tests |
| Fake provider covers status/revoke lifecycle | Pass | `share-provider.test.ts` |
| Public payload redaction proven | Pass | Existing `share-provider.test.ts` redaction cases |
| Local/private URLs rejected | Pass | Existing `assertPublicShareUrl` test |
| Session command can query share status | Pass | `session-share-provider.test.ts` |
| Renderer share states deterministic | Pass | `session-share-flow.test.ts` |
| Worklog complete | Pass | This file |
| Commit exists | Pass | Scoped Lore commit for T084 |
