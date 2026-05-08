# T112 - Provider SDK Public Risk Boundary Worklog

## 1. Task summary

Add a public-untrusted guard around remaining PI provider SDK discovery/OAuth
surfaces so public deployments do not import or invoke provider SDK paths before
dependency remediation, production isolation, or signed accepted-risk approval.

Initial state:

```text
## mac/rox-production-ready-rc...origin/mac/rox-production-ready-rc [ahead 14]
```

## 2. Repo context discovered

- T108 blocks PI session startup in public-untrusted mode.
- T110 blocks unsafe custom endpoint setup/test/save URLs.
- `packages/server-core/src/handlers/rpc/llm-connections.ts` still imports
  `@mariozechner/pi-ai` for provider model discovery and
  `@mariozechner/pi-ai/oauth` for GitHub Copilot OAuth without a dedicated
  public-untrusted guard before the import.
- These surfaces are part of the provider SDK dependency-risk lane in
  `docs/release/dependency-risk-register-2026-05-08.md`.

## 3. Tests added first

Extended `packages/server-core/src/domain/connection-setup-logic.test.ts`
before implementation. The new tests require:

- public app deployments default provider SDK mode to `public-untrusted`;
- explicit `CRAFT_LLM_PROVIDER_DEPENDENCY_RISK_MODE=accepted-risk` overrides
  the public default;
- `public-untrusted` rejects named provider SDK surfaces;
- `accepted-risk` and `isolated-worker` remain non-blocking.

Red command:

```bash
bun test packages/server-core/src/domain/connection-setup-logic.test.ts
```

## 4. Expected failing test output

Initial red run before exporting or implementing the provider SDK guard:

```text
0 pass
1 fail
1 error

SyntaxError: Export named 'resolveLlmProviderDependencyRiskMode' not found
```

## 5. Implementation changes

- Added `resolveLlmProviderDependencyRiskMode()` and
  `validatePublicProviderSdkAccess()` to the connection setup domain logic.
- Provider SDK risk-mode precedence:
  `CRAFT_LLM_PROVIDER_DEPENDENCY_RISK_MODE` ->
  `CRAFT_PROVIDER_DEPENDENCY_RISK_MODE` ->
  `CRAFT_PUBLIC_APP_URL` default ->
  `private-local`.
- In `public-untrusted` mode, named provider SDK surfaces return an actionable
  disabled error.
- `accepted-risk` and `isolated-worker` remain non-blocking.
- Wired `GET_PROVIDER_MODELS` through the guard before importing
  `@mariozechner/pi-ai`.
- Wired GitHub Copilot OAuth through the guard before importing
  `@mariozechner/pi-ai/oauth`.
- Updated dependency and accepted-risk release evidence so the current
  not-accepted dependency-audit row references T112 with the previous guard
  tickets.

## 6. Validation commands run

```bash
bun test packages/server-core/src/domain/connection-setup-logic.test.ts
bun test scripts/__tests__/dependency-risk-register-contract.test.ts
cd packages/server-core && bun run typecheck
bun run validate:docs
git diff --check
git diff --name-only | rg '(^|/)(package\.json|bun\.lock|bun\.lockb|pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$' || true
```

## 7. Passing test output summary

Focused server-core domain test:

```text
25 pass
0 fail
46 expect() calls
```

Dependency risk register contract:

```text
2 pass
0 fail
35 expect() calls
```

Server-core typecheck:

```text
cd packages/server-core && bun run typecheck: pass
```

Docs validation:

```text
[agent-contract] ok: 11 skills, 113 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated docs/architecture/sync-v2-design.md
```

Diff and manifest hygiene:

```text
git diff --check: pass
package/lockfile diff check: no output
```

## 8. Remaining risks

- This guard blocks provider SDK discovery/OAuth surfaces in public-untrusted
  mode. It does not upgrade vulnerable provider SDK dependencies.
- Other provider SDK paths still need dependency upgrades, isolation evidence,
  or signed accepted-risk approval before public production.

## 9. Acceptance criteria matrix

| Criteria | Status | Evidence |
|---|---|---|
| Provider SDK guard tests fail before implementation and pass after | Done | Red failed on missing export; green focused domain test passes |
| Public app default resolves provider SDK mode to `public-untrusted` | Done | Focused test passes |
| Explicit accepted-risk provider mode overrides public default | Done | Focused test passes |
| Public-untrusted rejects provider SDK discovery/OAuth surfaces | Done | Focused test passes |
| Accepted-risk and isolated-worker provider SDK behavior remains unchanged | Done | Focused test passes |
| Provider model discovery and Copilot OAuth handlers run the guard before SDK imports | Done | Handler wiring before dynamic `@mariozechner/pi-ai` imports plus typecheck |
| Dependency manifests and lockfiles remain unchanged | Done | Manifest/lockfile diff check returned no output |
| Docs validation passes | Done | `bun run validate:docs` |
| Worklog complete | Done | This file |
| Scoped Lore commit exists | Done | This commit |
