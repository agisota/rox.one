# T058 - Upstream Session Refresh Recovery

Status: DONE

## Context

Upstream Craft Agents OSS v0.9.0 includes a safe reconnect recovery fix for session metadata refresh. During stale reconnects after sleep/wake, `getSessions()` can transiently return a partial list. Treating that partial response as authoritative collapses the sidebar to only returned sessions.

## Goal

Port the minimal safe subset of the upstream v0.9.0 fix so stale reconnect metadata refresh preserves locally-visible sessions that are omitted by a transient partial `getSessions()` response, while keeping authoritative destructive refresh behavior as the default.

## Required UI

No new UI surface. User-visible behavior: the sidebar session list should not collapse after a stale reconnect partial response.

## Required Data/API

- Add an optional non-destructive mode to `refreshSessionsMetadataAtom`.
- Default refresh remains destructive/authoritative for workspace reload and confirmed missing sessions.
- Stale reconnect path calls metadata refresh in non-destructive mode.

## Required Tests

- Atom/unit coverage for preserving omitted sessions when non-destructive mode is enabled.
- Atom/unit coverage that returned sessions still preserve already-loaded messages in non-destructive mode.
- Existing destructive refresh test remains green.

## Acceptance Criteria

- [x] Tests were written before feature code.
- [x] Destructive refresh remains the default.
- [x] Non-destructive refresh preserves omitted session metadata and atoms.
- [x] Non-destructive refresh still preserves loaded messages for returned sessions.
- [x] Stale reconnect caller uses non-destructive refresh.
- [x] Targeted tests pass.
- [x] Electron typecheck passes.
- [x] Renderer build passes when applicable.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T058-upstream-v0.9.0-session-refresh.md`.
