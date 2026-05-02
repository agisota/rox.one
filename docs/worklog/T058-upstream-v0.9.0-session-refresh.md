# T058 - Upstream v0.9.0 Non-Destructive Session Refresh

## 1. Task summary

Ported the safe subset of upstream `lukilabs/craft-agents-oss` v0.9.0 session-list recovery into the ROX ONE fork: stale reconnect metadata refresh no longer deletes locally-visible sessions when `getSessions()` returns a transient partial list.

Scope stayed intentionally narrow: session metadata refresh atom + stale reconnect caller only. No Lark/Telegram/build/SDK/draft persistence feature work was included.

## 2. Repo context discovered

- Local repo: `/Users/marklindgreen/Projects/craft/craft`, branch `main`, HEAD before edits `b36b00c`.
- Upstream tag available: `v0.9.0` at `acb0884`.
- Existing local session recovery code already had:
  - `refreshSessionsMetadataAtom` in `apps/electron/src/renderer/atoms/sessions.ts`.
  - stale reconnect handler in `apps/electron/src/renderer/App.tsx`.
  - atom coverage in `apps/electron/src/renderer/atoms/__tests__/sessions.test.ts`.
- Upstream v0.9.0 adds `removeMissing?: boolean` to `refreshSessionsMetadataAtom`; stale reconnect calls it with `removeMissing: false` to avoid sidebar collapse after sleep/wake partial backend responses.
- Existing destructive behavior remains needed for authoritative refresh/workspace reload/delete paths and remains the default.

## 3. Files inspected

- `AGENTS.md`
- `.agents/skills/tdd-loop/SKILL.md`
- `docs/tickets/T054-experience-navigation-account-share-fix.md`
- `docs/tickets/T057-experience-layer-interaction-polish.md`
- `docs/tickets/T058-upstream-session-refresh-recovery.md`
- `package.json`
- `apps/electron/package.json`
- `apps/electron/src/renderer/App.tsx`
- `apps/electron/src/renderer/atoms/sessions.ts`
- `apps/electron/src/renderer/atoms/__tests__/sessions.test.ts`
- `apps/electron/src/renderer/lib/session-load.ts`
- upstream comparison: `git diff 72087dd..v0.9.0 -- apps/electron/src/renderer/atoms/sessions.ts apps/electron/src/renderer/App.tsx`

## 4. Tests added first

Added two atom tests in `apps/electron/src/renderer/atoms/__tests__/sessions.test.ts`:

1. `preserves omitted sessions when removeMissing is false`
2. `non-destructive refresh still preserves loaded messages for returned sessions`

These verify that transient partial lists update returned sessions but keep omitted session metadata/atoms visible.

## 5. Expected failing test output

Command:

```bash
bun test apps/electron/src/renderer/atoms/__tests__/sessions.test.ts
```

Expected red result before implementation:

- `preserves omitted sessions when removeMissing is false` failed because `result.has('s2')` was `false`.
- `non-destructive refresh still preserves loaded messages for returned sessions` failed because preserved metadata for `s2` was `undefined`.
- Summary: `6 pass, 2 fail`.

## 6. Implementation changes

- `apps/electron/src/renderer/atoms/sessions.ts`
  - Added optional `removeMissing?: boolean` to `refreshSessionsMetadataAtom` payload.
  - Default is `true`, preserving old authoritative/destructive behavior.
  - When `removeMissing` is `false`, the atom starts from the existing metadata map, upserts returned sessions, preserves omitted sessions, and orders sidebar IDs from the metadata actually exposed to the UI.
  - Loaded-message preservation for returned sessions remains unchanged.
- `apps/electron/src/renderer/App.tsx`
  - Added a narrow options object to `refreshSessionListMetadataFromServer`.
  - Stale reconnect path now calls `refreshSessionListMetadataFromServer({ removeMissing: false })` so a transient partial `getSessions()` response does not collapse the sidebar.

## 7. Validation commands run

- `git status --short --branch`
- `git rev-parse --short HEAD`
- `git branch --show-current`
- `git remote -v`
- `node -e "const p=require('./package.json'); for (const [k,v] of Object.entries(p.scripts)) console.log(k+'='+v)"`
- `bun test apps/electron/src/renderer/atoms/__tests__/sessions.test.ts` — baseline green before adding tests.
- `bun test apps/electron/src/renderer/atoms/__tests__/sessions.test.ts` — expected red after tests (`6 pass, 2 fail`).
- `bun test apps/electron/src/renderer/atoms/__tests__/sessions.test.ts` — green after implementation.
- `bun run typecheck:electron` — green.
- `cd apps/electron && bun run build:renderer` — green, with existing Vite large-chunk warnings.
- `bun test` — repo-wide run attempted; failed in unrelated pre-existing suites listed below.

## 8. Passing test output summary

Targeted command:

```bash
bun test apps/electron/src/renderer/atoms/__tests__/sessions.test.ts
```

Result:

- `8 pass`
- `0 fail`
- `34 expect() calls`
- `Ran 8 tests across 1 file`

Electron typecheck:

```bash
bun run typecheck:electron
```

Result: `tsc --noEmit`, exit `0`.

## 9. Build output summary

Renderer build command:

```bash
cd apps/electron && bun run build:renderer
```

Result:

- Vite build completed: `✓ built in 38.56s`.
- Warning only: some chunks larger than `500 kB` after minification; no build failure.

Repo-wide test gate:

```bash
bun test
```

Result:

- `28 tests failed`
- `Ran 4172 tests across 332 files`
- Failures are outside the touched session-refresh files, including PowerShell plans folder exception, routed client workspace switch, RPC channel wire-format stability, OAuth deeplink auth, workspace slug fallback, safe-mode session tools, PostgresAccountStore env integration, webui HTTP server cookie/ws config, and RPC handler registration tests.

## 10. Remaining risks

- This is a safe subset of upstream v0.9.0, not a full upstream merge.
- Upstream also contains related session-loading/draft/attachment hardening (`replaceLoadedSessionAtom`, `SessionDraft`, `readUserAttachment`) that was intentionally not included to avoid mixing broader changes.
- Repo-wide `bun test` is not green due to unrelated failures; targeted tests, Electron typecheck, and renderer build are green.
- Manual UI smoke for sleep/wake stale reconnect was not run in this headless pass.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---:|---|
| TDD tests added before implementation | ✅ | New tests failed before code patch: `6 pass, 2 fail`. |
| Destructive refresh remains default | ✅ | Existing test `removes stale sessions from all atoms` remains green. |
| Non-destructive refresh preserves omitted sessions | ✅ | New `removeMissing: false` test passes. |
| Non-destructive refresh preserves loaded messages for returned sessions | ✅ | New loaded-message preservation test passes. |
| Stale reconnect uses non-destructive refresh | ✅ | `App.tsx` passes `{ removeMissing: false }` in stale reconnect handler. |
| Targeted tests pass | ✅ | `8 pass, 0 fail` for session atom tests. |
| Relevant typecheck/build gate run | ✅ | `bun run typecheck:electron` exit `0`; renderer build `✓ built`. |
| Repo-wide tests considered | ⚠️ | `bun test` fails in unrelated suites; blocker documented above. |
| Worklog complete | ✅ | This file updated with red/green/build evidence. |
| Commit created | ✅ | This scoped task commit. |
