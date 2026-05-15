# Security Audit: RPC Handler Rate-Limiting Coverage

**Ticket:** T510
**Date:** 2026-05-15
**RC:** v1.0.0-rc.1
**Auditor:** Automated audit per CLAUDE.md security rule — "Rate-limit all public APIs: per-IP and per-user limits, return 429 with Retry-After."

---

## Summary

This document audits every RPC handler in `packages/server-core/src/handlers/rpc/` for rate-limiting coverage. The review covers the T086d abuse-guard middleware pattern (token-bucket `rateLimiter` + per-actor `budgetGuard`) shipped in the RC.

**Audit scope:** 22 registered RPC handler files, covering 218 `server.handle(...)` registrations.

---

## Methodology

Rate-limiting evidence was determined by direct inspection of each handler file registered by `packages/server-core/src/handlers/rpc/index.ts`. The abuse-guard pattern used in this codebase is:

1. **abuse-guard (token bucket):** `deps.rateLimiter.tryAcquire(1)` — global burst limiter injected via `HandlerDeps.rateLimiter`. Returns `{error: 'rate-limited', reason: 'token-bucket-exhausted'}` on exhaustion.
2. **per-actor budget guard:** `deps.budgetGuard.consume(key, 1)` — per-actor lifetime cap keyed by `ctx.userId`. Returns `{error: 'budget-exceeded', reason: 'per-actor-cap-exhausted'}` on exhaustion.
3. **`requireAdmin`:** Admin-only handlers gated via RBAC (`rbacResolver` owner grants). Implicit protection via access control rather than rate limiting.
4. **429 / Retry-After:** The RPC transport is WebSocket-based, not HTTP. There is **no `Retry-After` header** set on any rate-limited response — the error envelope `{error: 'rate-limited'}` is returned as an RPC result object. This is a protocol limitation; HTTP 429 semantics do not apply to WebSocket RPC messages.

**Columns:**
- **abuse-guard:** `✓` = `rateLimiter.tryAcquire` present on at least one mutating channel in the file; `—` = absent for all channels in file
- **per-user RL:** `✓` = `budgetGuard.consume` present; `—` = absent
- **429 Retry-After:** `n/a` = WS-RPC transport (not HTTP); no handler emits a Retry-After header

---

## Handler Audit Table

| Handler File | Channels | Mutating? | abuse-guard (rateLimiter) | per-user RL (budgetGuard) | 429 Retry-After | Status |
|---|---|---|---|---|---|---|
| `auth.ts` | `auth.logout`, `auth.showLogoutConfirmation`, `auth.showDeleteSessionConfirmation`, `credentials.healthCheck` | Yes (logout) | ✓ (`auth.logout`) | ✓ (`auth.logout`) | n/a (WS-RPC) | PARTIAL — logout guarded; UI dialogs and health-check are read-only, unguarded |
| `sessions.ts` | `sessions.get`, `sessions.getUnreadSummary`, `sessions.markAllRead`, `sessions.create`, `sessions.delete`, `sessions.sendMessage`, `sessions.cancel`, `sessions.killShell`, `tasks.getOutput`, `sessions.respondToPermission`, `sessions.respondToCredential`, `sessions.command`, `sessions.getPendingPlanExecution`, `sessions.getPermissionModeState`, `sessions.searchContent`, `sessions.getFiles`, `sessions.watchFiles`, `sessions.unwatchFiles`, `sessions.getNotes`, `sessions.setNotes`, `sessions.export`, `sessions.import`, `sessions.exportRemoteTransfer`, `sessions.importRemoteTransfer` | Yes (create, delete, sendMessage, setNotes, import, etc.) | ✓ (`create`, `delete`, `sendMessage`) | ✓ (`create`, `delete`, `sendMessage`) | n/a (WS-RPC) | PARTIAL — highest-risk mutation channels guarded; secondary channels (setNotes, command, import) unguarded |
| `sources.ts` | `sources.get`, `sources.create`, `sources.delete`, `sources.startOAuth`, `sources.saveCredentials`, `sources.getPermissions`, `workspace.getPermissions`, `permissions.getDefaults`, `sources.getMcpTools` | Yes (create, delete, saveCredentials) | ✓ (`create`, `delete`) | ✓ (`create`, `delete`) | n/a (WS-RPC) | PARTIAL — `saveCredentials` unguarded; `getMcpTools` (spawns MCP subprocess) unguarded |
| `workspace.ts` | `workspaces.get`, `workspaces.create`, `workspaces.checkSlug`, `workspaces.updateRemote`, `window.getWorkspace`, `window.getMode`, `window.switchWorkspace`, `workspace.readImage`, `workspace.writeImage`, `theme.*` (12 channels), `views.list`, `views.save`, `toolIcons.getMappings`, `logo.getUrl` | Yes (create, writeImage, views.save, theme.set*) | ✓ (`workspaces.create`) | ✓ (`workspaces.create`) | n/a (WS-RPC) | PARTIAL — `writeImage`, `views.save`, `theme.SET_*` unguarded |
| `roles.ts` | `roles.list`, `roles.create`, `roles.grant`, `roles.revoke` | Yes (create, grant, revoke) | ✓ (`grant`, `revoke`) | ✓ (`grant`, `revoke`) | n/a (WS-RPC) | PARTIAL — `roles.create` (global-owner-only) unguarded |
| `labels.ts` | `labels.list`, `labels.create`, `labels.delete` | Yes (create, delete) | ✓ (`create`, `delete`) | ✓ (`create`, `delete`) | n/a (WS-RPC) | PROTECTED — both mutating channels guarded |
| `statuses.ts` | `statuses.list`, `statuses.reorder` | Yes (reorder) | ✓ (`reorder`) | ✓ (`reorder`) | n/a (WS-RPC) | PROTECTED — only mutating channel guarded |
| `skills.ts` | `skills.get`, `skills.getFiles`, `skills.delete`, `skills.openEditor`, `skills.openFinder` | Yes (delete) | ✓ (`delete`) | ✓ (`delete`) | n/a (WS-RPC) | PROTECTED — only mutating channel guarded |
| `missions.ts` | `missions.create`, `missions.dispatchEvent`, `missions.get`, `missions.list` | Yes (create, dispatchEvent) | ✓ (`dispatchEvent`) | ✓ (`dispatchEvent`) | n/a (WS-RPC) | PARTIAL — `missions.create` (owner-gated) unguarded |
| `oauth.ts` | `oauth.start`, `oauth.complete`, `oauth.cancel`, `oauth.revoke` | Yes (all) | — | — | n/a (WS-RPC) | NEEDS REVIEW — all 4 OAuth channels lack rate limiting; OAuth-start abuse can trigger external provider floods |
| `onboarding.ts` | `onboarding.getAuthState`, `onboarding.validateMcp`, `onboarding.startMcpOAuth`, `onboarding.startClaudeOAuth`, `onboarding.exchangeClaudeCode`, `onboarding.hasClaudeOAuthState`, `onboarding.clearClaudeOAuthState`, `onboarding.deferSetup` | Yes (startOAuth, exchangeCode) | — | — | n/a (WS-RPC) | NEEDS REVIEW — `exchangeClaudeCode`, `startClaudeOAuth`, `startMcpOAuth` unguarded; code-exchange abuse could exhaust OAuth quotas |
| `llm-connections.ts` | `llmConnections.list`, `llmConnections.listWithStatus`, `llmConnections.get`, `llmConnections.getApiKey`, `llmConnections.save`, `llmConnections.delete`, `llmConnections.test`, `llmConnections.setDefault`, `llmConnections.setWorkspaceDefault`, `llmConnections.refreshModels`, `chatgpt.startOAuth`, `chatgpt.completeOAuth`, `chatgpt.cancelOAuth`, `chatgpt.getAuthStatus`, `chatgpt.logout`, `copilot.startOAuth`, `copilot.cancelOAuth`, `copilot.getAuthStatus`, `copilot.logout`, `settings.setupLlmConnection`, `settings.testLlmConnectionSetup`, `pi.getApiKeyProviders`, `pi.getProviderBaseUrl`, `pi.getProviderModels` | Yes (save, delete, test, setupLlm, startOAuth, completeOAuth) | — | — | n/a (WS-RPC) | NEEDS REVIEW — all channels protected by `requireAdmin` RBAC gate only; no burst-rate protection on `testLlmConnectionSetup` (spawns subprocess), `copilot.startOAuth` (external device flow), `chatgpt.completeOAuth` (token exchange) |
| `settings.ts` | `workspace.settingsGet`, `workspace.settingsUpdate`, `preferences.read`, `preferences.write`, `drafts.get`, `drafts.set`, `drafts.delete`, `drafts.getAll`, `input.getAutoCapitalisation`, `input.setAutoCapitalisation`, `input.getSendMessageKey`, `input.setSendMessageKey`, `input.getSpellCheck`, `input.setSpellCheck`, `power.getKeepAwake`, `appearance.getRichToolDescriptions`, `appearance.setRichToolDescriptions`, `caching.*` (4 channels), `sessions.getModel`, `sessions.setModel`, `settings.getDefaultThinkingLevel`, `settings.setDefaultThinkingLevel`, `tools.getBrowserToolEnabled`, `tools.setBrowserToolEnabled`, `settings.getNetworkProxy`, `dialog.openFolder` | Yes (settingsUpdate, preferences.write, drafts.set, input.set*, etc.) | — | — | n/a (WS-RPC) | NEEDS REVIEW — high-frequency settings mutations (drafts, preferences) lack rate protection |
| `files.ts` | `file.read`, `file.readDataUrl`, `file.readPreviewDataUrl`, `file.readBinary`, `file.openDialog`, `file.readAttachment`, `file.readUserAttachment`, `file.storeAttachment`, `file.generateThumbnail`, `fs.search`, `fs.listDirectory` | Yes (storeAttachment, generateThumbnail) | — | — | n/a (WS-RPC) | NEEDS REVIEW — `storeAttachment` (writes disk, resizes images) and `generateThumbnail` (CPU-intensive) unguarded |
| `resources.ts` | `resources.export`, `resources.import` | Yes (import) | — | — | n/a (WS-RPC) | NEEDS REVIEW — `resources.import` rewrites workspace files, unguarded |
| `automations.ts` | `automations.get`, `automations.test`, `automations.setEnabled`, `automations.duplicate`, `automations.delete`, `automations.getHistory`, `automations.getLastExecuted`, `automations.replay` | Yes (test, setEnabled, duplicate, delete, replay) | — | — | n/a (WS-RPC) | NEEDS REVIEW — `automations.test` (executes webhook + spawns session), `automations.replay` (replays webhooks) unguarded; high abuse potential |
| `transfer.ts` | `transfer.start`, `transfer.chunk`, `transfer.commit`, `transfer.abort` | Yes (all — assembles and executes arbitrary transferable handler) | — | — | n/a (WS-RPC) | NEEDS REVIEW — no rate limit; `transfer.chunk` with large payloads could exhaust disk; TTL mechanism only |
| `system.ts` | `theme.getSystemPreference`, `system.versions`, `system.homeDir`, `system.isDebugMode`, `debug.log`, `shell.openUrl`, `shell.openFile`, `shell.showInFolder`, `releaseNotes.get`, `releaseNotes.getLatestVersion`, `git.getBranch`, `gitbash.check`, `gitbash.browse`, `gitbash.setPath` | Yes (`shell.openUrl`, `gitbash.setPath`) | — | — | n/a (WS-RPC) | NEEDS REVIEW — `shell.openUrl` (external browser open), `debug.log` (renderer→disk) unguarded |
| `experience.ts` | `experience.emit`, `experience.subscribe`, `experience.unsubscribe` | Yes (emit) | — | — | n/a (WS-RPC) | NEEDS REVIEW — `experience.emit` (fans out to all subscribers) lacks rate limiting; fan-out amplification risk |
| `server.ts` | `server.getWorkspaces`, `server.createWorkspace`, `server.getStatus`, `server.getHealth`, `server.getActiveSessions`, `server.homeDir` | Yes (`createWorkspace`) | — | — | n/a (WS-RPC) | NEEDS REVIEW — workspace creation and server inventory endpoints have RBAC filtering but no burst-rate protection |
| `messaging.ts` | `messaging.getConfig`, `messaging.updateConfig`, `messaging.testTelegram`, `messaging.saveTelegram`, `messaging.testLark`, `messaging.saveLark`, `messaging.disconnect`, `messaging.forget`, `messaging.getBindings`, `messaging.generateCode`, `messaging.unbind`, `messaging.unbindBinding`, `messaging.generateSupergroupCode`, `messaging.getSupergroup`, `messaging.unbindSupergroup`, `messaging.waStartConnect`, `messaging.waSubmitPhone`, `messaging.getPlatformOwners`, `messaging.setPlatformOwners`, `messaging.getPlatformAccessMode`, `messaging.setPlatformAccessMode`, `messaging.getPendingSenders`, `messaging.dismissPendingSender`, `messaging.allowPendingSender`, `messaging.setBindingAccess` | Yes (config, credential, pairing, ownership, binding mutations) | — | — | n/a (WS-RPC) | NEEDS REVIEW — credential tests, pairing-code generation, ownership changes, and WhatsApp connect flow are unguarded |
| `admin/audit-list.ts` | `audit.list` | No (read-only) | — | — | n/a (WS-RPC) | OK — read-only; protected by global-owner RBAC gate |
| `experience-bus.ts` | (internal bus utility, not a handler file) | n/a | n/a | n/a | n/a | OUT OF SCOPE — internal module, no RPC channels |
| `account-ownership.ts` | (auth helper, not a handler file) | n/a | n/a | n/a | n/a | OUT OF SCOPE — utility module |
| `storage-scope.ts` | (storage helper, not a handler file) | n/a | n/a | n/a | n/a | OUT OF SCOPE — utility module |
| `_validators.ts` | (validation helpers, not a handler file) | n/a | n/a | n/a | n/a | OUT OF SCOPE — utility module |
| `index.ts` | (registration barrel, not a handler file) | n/a | n/a | n/a | n/a | OUT OF SCOPE — registration barrel |

---

## Aggregate Statistics

| Metric | Count |
|---|---|
| Total registered handler files with RPC channels | 22 |
| Channels audited | 218 |
| Handler files with abuse-guard (rateLimiter) | 9 |
| Handler files with per-user rate limit (budgetGuard) | 9 |
| Handler files fully PROTECTED | 3 (`labels.ts`, `statuses.ts`, `skills.ts`) |
| Handler files PARTIAL (some channels protected) | 6 (`auth.ts`, `sessions.ts`, `sources.ts`, `workspace.ts`, `roles.ts`, `missions.ts`) |
| Handler files NEEDS REVIEW (no rate limiting) | 12 (`oauth.ts`, `onboarding.ts`, `llm-connections.ts`, `settings.ts`, `files.ts`, `resources.ts`, `automations.ts`, `transfer.ts`, `system.ts`, `experience.ts`, `server.ts`, `messaging.ts`) |
| Handlers returning 429 HTTP status with Retry-After | 0 — WS-RPC transport; error returned as structured RPC result envelope |

**Coverage rate of T086d abuse-guard pattern:** ~41% of registered handler files (9/22). The T086d ticket applied the pattern selectively to high-priority channels; remaining handler files were deferred.

---

## Risk-Ordered Fix Recommendations

Handlers are ordered by exploitation potential (external exposure × mutation impact):

### P1 — Critical (authentication, OAuth, credential flows)

1. **`oauth.ts`** — All 4 channels (`oauth.start`, `oauth.complete`, `oauth.cancel`, `oauth.revoke`) lack rate limiting. `oauth.start` triggers external OAuth provider requests; a burst can exhaust provider rate limits or generate spam login notifications. `oauth.revoke` repeatedly revoking could destabilize sessions.

2. **`onboarding.ts`** — `startClaudeOAuth`, `startMcpOAuth`, and `exchangeClaudeCode` are unprotected. Repeated calls to `exchangeClaudeCode` with invalid codes against the Anthropic OAuth endpoint could trigger provider bans.

3. **`llm-connections.ts`** — `testLlmConnectionSetup` spawns a subprocess and makes a real API call to the configured provider for each invocation. Burst calls can exhaust provider credits or trigger bans. `copilot.startOAuth` opens a GitHub device flow for each call with no dedup; `chatgpt.completeOAuth` exchanges tokens with ChatGPT's OAuth endpoint.

### P2 — High (resource-intensive mutations)

4. **`automations.ts`** — `automations.test` can spawn a session (model inference) and fire webhook actions simultaneously. `automations.replay` fires live webhooks. Both are CPU/network intensive and unprotected.

5. **`files.ts`** — `file.storeAttachment` decodes base64 data, runs image validation, resizes images, writes to disk, and generates thumbnails. `file.generateThumbnail` is CPU-intensive. Neither has rate limiting.

6. **`transfer.ts`** — `transfer.chunk` writes data to a temp directory with only a TTL cleanup. Concurrent burst chunk uploads can saturate disk I/O without a rate gate.

### P3 — Medium (state mutation, amplification)

7. **`experience.ts`** — `experience.emit` fans out to all subscribed clients. Without a rate gate, an owner can trigger unbounded push traffic to connected renderers.

8. **`resources.ts`** — `resources.import` rewrites workspace files (skills, sources, automations). Burst imports can cause repeated filesystem thrashing.

9. **`settings.ts`** — `preferences.write` and `workspace.settingsUpdate` write config files on every call. `sessions.setModel` and `drafts.set` are called frequently from the UI; a misbehaving client could generate unbounded writes.

### P4 — Low (read-only or UI-gated)

10. **`system.ts`** — `shell.openUrl` (external browser), `debug.log` (disk write), and `git.getBranch` (subprocess) are callable per-RPC with no rate gate. Low risk in Electron context (trusted origin); higher risk in WebSocket/server deployments.

11. **`server.ts`** — `server.createWorkspace` mutates global workspace config and `server.getWorkspaces` / `server.getActiveSessions` expose inventory after ownership filtering. Add a burst gate before workspace creation and consider a low-cost read throttle for inventory endpoints.

12. **`messaging.ts`** — `messaging.testTelegram`, `messaging.testLark`, WhatsApp connect, pairing-code generation, credential saves, and owner/access mutations are unguarded. These endpoints can hit external messaging providers or mutate workspace access state and should receive a shared messaging abuse guard.

---

## 429 / Retry-After Gap

None of the rate-limited responses currently return an HTTP 429 status code with a `Retry-After` header. The transport is WebSocket-based RPC; responses are JSON envelopes containing `{error: 'rate-limited', reason: 'token-bucket-exhausted'}`. To comply with the CLAUDE.md rule for public-API 429 semantics, the HTTP layer wrapping the WebSocket upgrade (or any REST gateway) should be configured to translate these envelopes into 429 responses with appropriate headers. This is an architectural gap separate from the per-handler fixes.

---

## Recommended Follow-Up Tickets

| Ticket | Scope | Priority | Fix Size |
|---|---|---|---|
| T512 | Add rate limiting to all 4 `oauth.ts` channels (`start`, `complete`, `cancel`, `revoke`) | P1 | S — 1-line abuse-guard envelope per mutating channel |
| T513 | Add rate limiting to `onboarding.ts` auth-flow channels (`startClaudeOAuth`, `startMcpOAuth`, `exchangeClaudeCode`) | P1 | S |
| T514 | Add rate limiting to `llm-connections.ts` expensive channels (`testLlmConnectionSetup`, `copilot.startOAuth`, `chatgpt.completeOAuth`) | P1 | S |
| T515 | Add rate limiting to `automations.ts` (`automations.test`, `automations.replay`) | P2 | S |
| T516 | Add rate limiting to `files.ts` (`storeAttachment`, `generateThumbnail`) + disk-write throttle | P2 | M — needs per-session or per-workspace scope |
| T517 | Add rate limiting to `transfer.ts` (`start`, `chunk`) + chunk count cap per transfer | P2 | M |
| T518 | Add rate limiting to `experience.ts` (`experience.emit`) + subscriber fan-out cap | P3 | S |
| T519 | Add rate limiting to `resources.ts` (`resources.import`) | P3 | S |
| T520 | Add 429 + `Retry-After` HTTP translation layer for WS-RPC rate-limit envelopes | P3 | L — architectural; affects transport layer |
| T521 | Close remaining partial handlers: `sessions.ts` (command, setNotes, import), `sources.ts` (saveCredentials, getMcpTools), `workspace.ts` (writeImage, views.save, theme.set*), `roles.ts` (create), `missions.ts` (create) | P3 | S each |
| T522 | Add rate limiting to `messaging.ts` provider/pairing/access mutations and `server.ts` workspace creation | P3 | M |
