# ROX ONE Agent Workbench Suite - Admin Guide 2026-05-06

Audience: private repo operators and release validators.
Branch: `mac/rox-production-ready-rc`

## 1. Local Validation

Run the RC gate from repo root:

```bash
bun run validate:docs
bun run validate:agent-contract
bun run typecheck:all
bun test
bun run lint
bun run electron:build
bun run validate:ci
bun run validate:e2e-core-scenarios
bun run e2e:core
bun run electron:smoke
bun run validate:mac-arm-build-workflow
git diff --check
```

The canonical CI parity command is:

```bash
bun run validate:ci
```

## 2. Private CI/Release

The private release pipeline validates:

- docs and agent contracts;
- architecture docs;
- CI contract;
- private release pipeline contract;
- shared config/model tests;
- document tool smoke tests;
- i18n parity, sorting, and coverage;
- Mac ARM workflow contract.

No workflow should upload public artifacts unless explicitly configured.

## 3. Provider Policy

Default RC policy:

```text
tests and local validators
  -> deterministic fake providers only

production adapters
  -> require explicit credentials, observability, rate limits, redaction,
     retry taxonomy, and billing attribution
```

Never enable real LLM, S3, payment, email, browser, marketplace, shortlink, or
public viewer providers in tests.

## 4. Security Model

Core invariants:

- mission finalization requires stored final artifact and stored passing gate;
- failed blocking gates prevent final pass;
- paid entitlement cannot satisfy quality/evidence/VDI/validation gates;
- package install/fork requires trust evidence;
- public/share payloads redact secrets, session cookies, provider keys, and
  private local file content;
- duplicate runtime events are idempotent where required.

## 5. Release Hygiene

Before committing or pushing:

```bash
git status --short --branch
git diff --check
```

Do not stage:

```text
events.jsonl
.claude/
runtime logs
caches
secrets
build output
generated local state
```

Commits must use the Lore protocol trailers.

## 6. Production Adapter Checklist

Before public launch, add and validate:

- real provider credentials and redaction;
- hosted persistence adapter;
- public share/viewer service;
- email verification provider;
- payment provider with webhook signature validation;
- hosted durable mission workers;
- package provenance/signing;
- signed and notarized macOS distribution;
- monitoring, alerting, audit retention, and incident runbook.
