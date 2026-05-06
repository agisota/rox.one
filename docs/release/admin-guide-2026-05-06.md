# ROX ONE Agent Workbench - Admin Guide

Date: 2026-05-06
Repository: `/Users/marklindgreen/Projects/rox/rox`
Integration branch: `mac/rox-e2e-integration`

## 1. Operator Model

This project is a white-label fork of Rox Agents OSS. The ROX-owned layers
must be preserved during upstream updates:

```text
ROX branding / i18n
Workbench screens
Account cabinet
Share/session provider seams
Experience Layer
Persistence contracts
Release docs
Security tests
```

Do not stage local runtime artifacts:

```text
events.jsonl
.claude/
```

## 2. Development Commands

Primary gates:

```bash
bun run validate:docs
bun run validate:agent-contract
bun run typecheck:all
bun test
bun run lint
bun run electron:build
git diff --check
```

Release/e2e gates:

```bash
bun run validate:ci
bun run validate:e2e-core-scenarios
bun run e2e:core
bun run electron:smoke
bun run validate:release
```

Private release workflow validator:

```bash
bun run validate:private-release-pipeline
```

Mac ARM workflow contract:

```bash
bun run validate:mac-arm-build-workflow
```

## 3. Fake Provider Rule

Tests must not call real external providers.

Allowed in tests:

```text
Fake LLM provider
Fake research/browser provider
Fake object storage provider
Fake email/outbox provider
Fake billing/payment provider
Fake share/shortlink provider
Fake scheduler/clock provider
Fake agent registry provider
```

Forbidden in tests:

```text
OpenAI/Anthropic/Google live calls
real S3/R2/MinIO writes
real payment settlement
real email delivery
real browser automation against public services
real public viewer uploads
real marketplace/package registry mutation
```

## 4. Release Architecture

```text
Renderer
  -> preload bridge
  -> Electron main
  -> server-core domain handlers
  -> persistence adapter
  -> provider gateway
  -> artifact/evidence/audit
  -> validation gates
  -> selector projection
  -> Renderer feedback
```

## 5. Account Operations

Session handling:

```text
login/register response
  -> main process account proxy
  -> rox_session captured
  -> Electron safeStorage encryption
  -> userData session file
  -> bootstrap hydration
  -> account/me confirmation
```

Admin invariants:

- do not expose `rox_session` to renderer state;
- logout clears encrypted session state;
- corrupt session fails closed;
- public share payloads must never include account cookies/tokens.

## 6. Mission Operations

Mission scheduler invariants:

```text
persist before execute
recover after restart
idempotent checkpoint execution
evidence required for final completion
budget/capacity checked before branch expansion
human approval required for expensive swarm expansion
```

Do not mark a long mission complete from elapsed time alone.

## 7. Provider Gateway Operations

Provider error taxonomy should map failures to user-visible states:

```text
auth_required
rate_limited
timeout
retryable
permanent
invalid_output
budget_denied
provider_unavailable
```

Provider outputs must be sanitized before public/share/audit exposure.

## 8. Security Gates

Before public release, these checks must stay green:

```text
tenant isolation
workspace RBAC
team/private package visibility
ledger spoofing
quota bypass
shortlink payload leakage
prompt-injection package scan
mission budget bypass
paid entitlement bypass
secret redaction
sync conflict overwrite
account/session public payload leakage
```

## 9. Private CI/CD

The private release workflow is expected to run:

```text
bun install --frozen-lockfile
validate docs
lint
typecheck
tests
Electron build
Mac ARM workflow contract
private artifact upload
```

The CI contract is local-validated through:

```bash
bun run validate:private-release-pipeline
bun run validate:ci-contract
```

## 10. Upstream Merge Rule

When merging future Rox Agents upstream changes:

```text
1. Create a protected merge branch.
2. Generate upstream diff map.
3. Check ROX protected paths before resolving conflicts.
4. Run docs/typecheck/tests/e2e/build.
5. Never drop ROX Workbench, account, i18n, Experience, or release docs silently.
```

Protected surfaces:

```text
apps/electron/src/renderer/components/workbench/
apps/electron/src/renderer/pages/settings/
apps/electron/src/main/account-api.ts
packages/shared/src/workbench/
packages/shared/src/i18n/
packages/server-core/src/webui/
packages/server-core/src/sync/
docs/tickets/
docs/worklog/
docs/release/
.swarm/
```

## 11. Production Readiness Checklist

Before public launch:

- connect real provider adapters;
- deploy durable scheduler workers;
- connect production storage;
- connect production shortlink/viewer backend;
- connect production email verification;
- connect payment provider and webhook reconciliation;
- complete dependency audit remediation;
- sign/notarize macOS release;
- run clean-machine install and launch smoke;
- run external security review of public share/account/session flows.
