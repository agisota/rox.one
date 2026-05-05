# T039 - Observability and Audit Trail

## 1. Task summary
Add a deterministic audit trail foundation for account/team operations. The T039 slice focuses on the shared truth layer: schema, redaction, RBAC-protected team audit API, and server wiring.

## 2. Repo context discovered
- `packages/server-core/src/webui/account-events.ts` already had an in-memory account event history, but only with `userId/type/title/details/createdAt`.
- `GET /api/account/events` already served user-scoped events from injected history.
- Team stores and RBAC helpers already live in `packages/server-core/src/webui/http-server.ts`.
- The headless server did not instantiate or pass `InMemoryAccountEventHistory`.

## 3. Files inspected
- `packages/server-core/src/webui/account-events.ts`
- `packages/server-core/src/webui/account-cabinet.ts`
- `packages/server-core/src/webui/http-server.ts`
- `packages/server-core/src/webui/index.ts`
- `packages/server-core/src/webui/__tests__/account-events.test.ts`
- `packages/server-core/src/webui/__tests__/account-http.test.ts`
- `packages/server/src/index.ts`
- `packages/server/package.json`

## 4. Tests added first
- Added unit tests for actor/action/target defaults, team audit isolation, and freeform string redaction.
- Added HTTP/RBAC test for owner-only team audit read access with viewer, outsider, and anonymous denial.

## 5. Expected failing test output
`bun test packages/server-core/src/webui/__tests__/account-events.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts` failed as expected:
- `adds actor, action, and target fields to every audit event`: missing `action`, `actor`, and `target` fields.
- `lists team audit events newest first without cross-team leakage`: `history.listForTeam is not a function`.
- `redacts secrets embedded in freeform strings`: raw `raw-token` and `sk-live-secret0000` still present.
- `exposes team audit events only to owner/admin memberships`: `/api/account/teams/:teamId/audit` returned `404`.

## 6. Implementation changes
- Extended `AccountEventRecord`/`AccountEventInput` with `actor`, `action`, `target`, optional `teamId`, `severity`, `source`, and `metadata`.
- Added default actor/action/target values for account events.
- Added `listForTeam(teamId)` with newest-first ordering and team isolation.
- Added string-level secret redaction for bearer tokens, `sk-*` keys, and query/form-style token values.
- Added `/api/account/teams/:teamId/audit` route guarded by owner/admin team RBAC.
- Exported `InMemoryAccountEventHistory` from the webui package and wired a default instance in the headless server when hosted accounts are enabled.

## 7. Validation commands run
- `bun test packages/server-core/src/webui/__tests__/account-events.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts`
- `cd packages/server-core && bun run tsc --noEmit`
- `cd packages/server && bun run typecheck`
- `bun run validate:agent-contract`
- `git diff --check`
- `bun run electron:smoke`

## 8. Passing test output summary
- Targeted server-core tests: `25 pass`, `0 fail`, `162 expect() calls`.
- `validate:agent-contract`: `[agent-contract] ok: 11 skills, 48 tickets, 7 required docs`.
- `git diff --check`: passed with no whitespace errors.

## 9. Build output summary
- `server-core` TypeScript: pass.
- `server` TypeScript: pass.
- Electron smoke built main/preload/renderer/resources/assets and reached `[smoke] Electron headless startup passed`.

## 10. Remaining risks
- T039 adds the audit truth model and team read API, but does not yet add a dedicated UI audit page. Existing account log surfaces can consume the richer event DTO.
- Audit history remains in-memory for hosted server bootstrap; durable persistence should be a later storage task before production deployment.
- Prior `bun audit` from T038 still reported dependency vulnerabilities and remains an open dependency-hardening lane.

## 11. Acceptance criteria matrix
- [x] Every event has actor/action/target audit fields.
- [x] Team audit events are listable by team without cross-team leakage.
- [x] Viewer and outsider roles cannot read team audit logs.
- [x] Secrets are redacted from keys and freeform strings.
- [x] Headless server wires a default event history when hosted accounts are enabled.
- [x] Relevant validation passes.
- [x] Commit created.
