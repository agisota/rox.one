# Security Integrity Audit (T052 extension)

M.13 security hardening. Inventory of every "integrity" surface in
`@rox-one/shared` and the current protection state on each. The
companion test file
`packages/shared/src/auth/__tests__/integrity-pass.test.ts` exercises
the surfaces marked with bold-faced "tested here" below; remaining
gaps are filed as T052b follow-ups (no source change in this PR).

## Method

For each surface we record (a) the data structure whose tampering would
breach a security boundary, (b) the storage / transport layer that
holds it, (c) the runtime guard that detects tampering, and (d) the
gap (if any). "Integrity" here means *resistance to in-place
modification of a persisted or in-flight payload*; secrecy and
availability are out of scope.

## Findings table

| # | Surface                          | Holder                                                    | Integrity guard                                                                             | State                   |
| - | -------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------- |
| 1 | RBAC `RoleGrant`                 | `InMemoryGrantStore.grantsByUser` (in-memory)             | `validateRoleGrant` / `assertValidRoleGrant` at seed + `grant()` boundary                   | **tested here**         |
| 2 | RBAC reserved `'*'` sentinel     | `RoleGrant.scopeId` for `workspace`/`org`                 | `validateRoleGrant` rejects `'*'` as a literal scope id (T244)                              | **tested here**         |
| 3 | Custom-role registry             | `InMemoryRoleStore.customRoles` (in-memory)               | `create()` throws on collision with `SYSTEM_ROLES` ids                                      | covered by `role-store` |
| 4 | Policy decision (`evaluate`)     | Pure function over `RoleGrant[]`                          | Forged roleId not in `ROLE_ACTIONS` rejected; scope-kind mismatch denied                    | **tested here**         |
| 5 | `permittedWorkspaces` output     | Frozen `ReadonlyArray<string>`                            | `Object.freeze` on return; literal `'*'` reserved by #2                                     | **tested here**         |
| 6 | Audit-event payload              | `AuditEventRecord.payloadJson` (canonical JSON)           | SHA-256 hash chain (`previousEventHash` + `eventHash`), `verifyAuditHashChain`              | **tested here**         |
| 7 | Audit-event payload secrets      | `sanitizeValue` / `sanitizeString`                        | Redacts `token`, `secret`, `password`, `apiKey`, `authorization`, `cookie`, Bearer, sk- API | **tested here**         |
| 8 | Credentials at rest              | `~/.rox/credentials.enc` (file-system)                    | AES-256-GCM with auth tag; PBKDF2-derived key from hardware UUID; magic + corruption detect | covered by SecureStorage |
| 9 | OAuth flow state (CSRF)          | `OAuthFlowStore.flows` (in-memory, 5-min TTL)             | Lookup keyed by random `state` token; binding fields validated on complete                  | covered by `oauth.test` |
| 10| OAuth PKCE verifier              | `PendingOAuthFlow.codeVerifier` (in-memory)               | PKCE S256 challenge bound to flow; verifier never leaves server                             | covered by `oauth.test` |
| 11| Claude OAuth refresh tokens      | Credential store (item #8)                                | AES-GCM auth tag, mutex on refresh path                                                     | covered by SecureStorage |
| 12| Session tokens (Claude/LLM)      | Credential store (item #8) — no separate signed JWT       | Inherits AES-GCM guarantee; no signature ring                                               | no separate test needed |
| 13| Workspace scope (`tenantId`)     | `BrandedWorkspaceScope` type, runtime-checked             | `deriveScopeFromAuth` rejects unknown tenant                                                | covered elsewhere       |

## Gaps and follow-ups

- Audit chain has **no signing key**: a malicious local writer who can
  recompute SHA-256 can rewrite the chain end-to-end. Acceptable for a
  local single-user runtime; remote tamper-evidence is a future
  hardware-rooted signer (T052b-1).
- Credentials use a *device-bound* key; export to another machine
  intentionally fails. There is no per-record HMAC outside the GCM
  auth tag — adequate while AEAD is in use (T052b-2 if KEM swap lands).
- Session tokens are stored verbatim inside the encrypted credential
  store; we do not separately sign them. This is by design — the
  envelope is the integrity boundary.

No real integrity bugs were observed during this pass.
