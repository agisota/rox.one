# T108 - PI Provider Public Risk Boundary Worklog

## 1. Task summary

Add an explicit dependency-risk policy around the PI provider backend so public
untrusted headless exposure cannot silently start the PI SDK subprocess path
recorded as a T104 public-production blocker.

Initial state:

```text
## mac/rox-production-ready-rc...origin/mac/rox-production-ready-rc [ahead 10]
```

T106 covers document conversion and T107 covers Lark/WhatsApp messaging. This
ticket targets the remaining provider/PI runtime lane from T104.

## 2. Repo context discovered

- `docs/release/dependency-risk-register-2026-05-08.md` records provider risk
  for `@mariozechner/pi-ai`, `@mariozechner/pi-agent-core`,
  `@anthropic-ai/sdk`, and transitive `protobufjs`.
- `packages/shared/src/agent/pi-agent.ts` owns PI subprocess startup before the
  child `packages/pi-agent-server` process is spawned.
- PI startup currently checks the resolved `piServerPath` before any explicit
  public dependency-risk policy.
- `packages/shared/src/agent/__tests__/pi-agent-error-handling.test.ts` and
  `pi-agent-bedrock-env.test.ts` show the existing pattern for constructing
  `PiAgent` in focused unit tests.

## 3. Files inspected

- `docs/release/dependency-risk-register-2026-05-08.md`
- `docs/release/production-readiness-matrix-2026-05-06.md`
- `packages/shared/src/agent/pi-agent.ts`
- `packages/shared/src/agent/backend/types.ts`
- `packages/shared/src/agent/__tests__/pi-agent-error-handling.test.ts`
- `packages/shared/src/agent/__tests__/pi-agent-bedrock-env.test.ts`
- `packages/pi-agent-server/src/index.ts`

## 4. Tests added first

Added `packages/shared/src/agent/__tests__/pi-agent-dependency-risk.test.ts`
before implementation:

- public app URL defaults PI provider dependency-risk mode to
  `public-untrusted`;
- PI-specific risk mode overrides generic provider risk mode;
- `public-untrusted` PI startup rejects before the existing missing
  `piServerPath` error;
- `accepted-risk` preserves the existing startup path check.

Red command:

```bash
bun test packages/shared/src/agent/__tests__/pi-agent-dependency-risk.test.ts
```

## 5. Expected failing test output

Initial red run before helper/guard implementation:

```text
Cannot find module '../dependency-risk.ts'
0 pass
1 fail
1 error
```

## 6. Implementation changes

- Added `packages/shared/src/agent/dependency-risk.ts` with a small
  `ProviderDependencyRiskMode` parser and PI-specific resolver.
- Resolver precedence:
  `ROX_PI_PROVIDER_DEPENDENCY_RISK_MODE` ->
  `ROX_PROVIDER_DEPENDENCY_RISK_MODE` ->
  `ROX_PUBLIC_APP_URL` default ->
  `private-local`.
- Added `assertPiProviderDependencyRiskAllowed()` so only `public-untrusted`
  blocks; `private-local`, `accepted-risk`, and `isolated-worker` remain
  non-blocking.
- Wired `PiAgent.spawnSubprocess()` through the guard before
  `getBackendRuntime()`, `piServerPath` lookup, credential fetch, or child
  process startup.

## 7. Validation commands run

```bash
bun test packages/shared/src/agent/__tests__/pi-agent-dependency-risk.test.ts
bun test packages/shared/src/agent/__tests__/pi-agent-error-handling.test.ts packages/shared/src/agent/__tests__/pi-agent-bedrock-env.test.ts
bun run typecheck:shared
bun run validate:docs
git diff --check
git diff --name-only | rg '(^|/)(package\.json|bun\.lock|bun\.lockb|pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$' || true
```

## 8. Passing test output summary

Focused dependency-risk test:

```text
4 pass
0 fail
4 expect() calls
```

Adjacent PI tests:

```text
6 pass
0 fail
17 expect() calls
```

Typecheck:

```text
bun run typecheck:shared: pass
```

Docs and diff checks:

```text
[agent-contract] ok: 11 skills, 109 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated docs/architecture/sync-v2-design.md
git diff --check: pass
lockfile/package manifest diff check: no output
```

## 9. Build output summary

No full build expected for this bounded PI startup guard unless targeted
typecheck or tests show wider impact.

## 10. Remaining risks

- This ticket adds a runtime policy guard. It does not remediate or upgrade the
  vulnerable provider packages recorded in T104.
- Public production remains blocked until dependency remediation or signed
  accepted-risk approval plus isolation evidence and external security review.
- Remote push remains blocked in the current already-running Codex session
  because it was launched with the old approval mode; `~/.zshrc` has been
  corrected for the next session.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
|---|---|---|
| Public URL defaults PI provider risk mode to public-untrusted | Done | Focused dependency-risk test passes |
| Explicit PI-specific risk mode overrides generic mode | Done | Focused dependency-risk test passes |
| Public-untrusted PI startup rejects before missing piServerPath / credentials | Done | Focused dependency-risk test passes |
| Private/local or accepted-risk PI startup behavior remains unchanged | Done | Accepted-risk test reaches existing `piServerPath not configured` error |
| Dependency manifests and lockfiles remain unchanged | Done | Lockfile/package manifest diff check returned no output |
| Docs validation passes | Done | `bun run validate:docs` passed |
| Worklog complete | Done | This file |
| Scoped Lore commit exists | Done | This commit |
