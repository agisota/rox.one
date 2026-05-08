# T110 - Public Custom Endpoint SSRF Guard Worklog

## 1. Task summary

Add a public-untrusted custom endpoint guard so hosted deployments do not test
or save loopback, private-network, or link-local LLM endpoint base URLs before
remediation, isolation, or accepted-risk approval.

Initial state:

```text
## mac/rox-production-ready-rc...origin/mac/rox-production-ready-rc [ahead 12]
```

## 2. Repo context discovered

- `docs/release/dependency-risk-register-2026-05-08.md` still lists SSRF/proxy
  tests around public HTTP/provider paths as a remediation lane.
- `packages/server-core/src/domain/connection-setup-logic.ts` owns pure
  connection setup validation helpers.
- `packages/server-core/src/handlers/rpc/llm-connections.ts` tests and saves
  LLM custom endpoint base URLs.
- Existing behavior intentionally allows loopback endpoints for private/local
  model runtimes.

## 3. Files inspected

- `docs/release/dependency-risk-register-2026-05-08.md`
- `packages/server-core/src/domain/connection-setup-logic.ts`
- `packages/server-core/src/domain/connection-setup-logic.test.ts`
- `packages/server-core/src/handlers/rpc/llm-connections.ts`
- `apps/cli/src/index.ts`
- `packages/shared/src/auth/oauth.ts`

## 4. Tests added first

Extended `packages/server-core/src/domain/connection-setup-logic.test.ts`
before implementation. The new tests require:

- public app deployments default to `public-untrusted`;
- explicit `accepted-risk` overrides the public default;
- `public-untrusted` rejects loopback, private, and link-local custom endpoint
  base URLs;
- `public-untrusted` allows public HTTPS custom endpoint URLs;
- `private-local` and `accepted-risk` preserve existing local endpoint behavior.

Red command:

```bash
bun test packages/server-core/src/domain/connection-setup-logic.test.ts
```

## 5. Expected failing test output

Initial red run before exporting or implementing the guard:

```text
0 pass
1 fail
1 error

SyntaxError: Export named 'validatePublicCustomEndpointBaseUrl' not found
```

## 6. Implementation changes

- Added `LlmEndpointDependencyRiskMode`,
  `resolveLlmEndpointDependencyRiskMode()`, and
  `validatePublicCustomEndpointBaseUrl()` to
  `packages/server-core/src/domain/connection-setup-logic.ts`.
- Risk-mode precedence:
  `ROX_LLM_ENDPOINT_DEPENDENCY_RISK_MODE` ->
  `ROX_PROVIDER_DEPENDENCY_RISK_MODE` ->
  `ROX_PUBLIC_APP_URL` default ->
  `private-local`.
- In `public-untrusted` mode, custom endpoint base URLs are rejected when they
  target loopback, private IPv4, link-local IPv4, IPv6 loopback, IPv6
  link-local, or IPv6 unique-local addresses.
- Public hostnames and public HTTPS endpoints remain allowed.
- `private-local`, `accepted-risk`, and `isolated-worker` remain non-blocking.
- Wired the guard into:
  - `settings:setupLlmConnection` before connection creation/update;
  - `settings:testLlmConnectionSetup` before backend test network calls;
  - `LLM_Connection:save` before persistence/runtime refresh.
- Normalized nullable `setup.baseUrl` to `undefined` at the handler boundary
  after typecheck exposed the DTO shape.

## 7. Validation commands run

```bash
bun test packages/server-core/src/domain/connection-setup-logic.test.ts
cd packages/server-core && bun run typecheck
bun run validate:docs
git diff --check
git diff --name-only | rg '(^|/)(package\.json|bun\.lock|bun\.lockb|pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$' || true
```

## 8. Passing test output summary

Focused server-core domain test:

```text
21 pass
0 fail
41 expect() calls
```

Server-core typecheck:

```text
cd packages/server-core && bun run typecheck: pass
```

Docs validation:

```text
[agent-contract] ok: 11 skills, 111 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated docs/architecture/sync-v2-design.md
```

Diff and manifest hygiene:

```text
git diff --check: pass
package/lockfile diff check: no output
```

## 9. Build output summary

No full build expected for this bounded server-core guard unless focused
typecheck or tests show wider impact.

## 10. Remaining risks

- This guard blocks obvious local/private/link-local custom endpoint targets in
  public-untrusted mode; it does not resolve DNS to detect hostnames that later
  resolve to private addresses.
- It does not upgrade vulnerable provider SDK transitive dependencies.
- Other provider SDK HTTP paths still need dependency upgrades, production
  isolation evidence, or accepted-risk approval before public production.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
|---|---|---|
| Guard tests fail before implementation and pass after | Done | Red failed on missing export; green focused test passes |
| Public app default resolves to `public-untrusted` | Done | Focused test passes |
| Explicit accepted-risk mode overrides public default | Done | Focused test passes |
| Public-untrusted rejects loopback/private/link-local custom endpoint URLs | Done | Focused test passes |
| Public-untrusted allows public HTTPS custom endpoint URLs | Done | Focused test passes |
| Private-local and accepted-risk behavior remains unchanged | Done | Focused test passes |
| Setup/test/save handlers run the guard before network calls or persistence | Done | Handler wiring plus server-core typecheck |
| Dependency manifests and lockfiles remain unchanged | Done | Manifest/lockfile diff check returned no output |
| Docs validation passes | Done | `bun run validate:docs` passed |
| Worklog complete | Done | This file |
| Scoped Lore commit exists | Done | This commit |
