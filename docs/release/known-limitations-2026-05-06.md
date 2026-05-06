# ROX ONE Agent Workbench Suite - Known Limitations 2026-05-06

Branch: `mac/rox-production-ready-rc`
Scope: Private/local fake-provider-safe RC.

## 1. Release Boundary

The RC proves product contracts, local Electron build, deterministic tests, and
private validation. It does not claim public SaaS readiness.

```text
fake provider
  -> deterministic contract behavior
  -> reducer/projection tests
  -> local build/smoke proof
  -> production adapter seam
```

## 2. Production Blockers

| Area | RC state | Production need |
|---|---|---|
| LLM providers | Prompt registry and fake provider gateway pass tests. | Real adapter credentials, rate limits, telemetry, retry budgets, billing attribution. |
| Mission scheduler | Durable contracts and fake-clock tests exist. | Hosted worker/queue deployment, restart recovery in production, notifications. |
| Persistence | Adapter seams and in-memory deterministic tests exist. | Production DB schema, migrations, backup, tenant isolation under real storage. |
| Public share | Provider contract, fake status lifecycle, redaction tests exist. | Public viewer, object storage, shortlink service, revocation monitoring, abuse controls. |
| Account/email | Embedded ROX ID states are truthful. | Real auth backend, email verification delivery, resend/rate-limit policy. |
| Billing | Ledger/capacity contracts exist. | Payment provider, webhook signature validation, reconciliation, refunds/chargebacks. |
| Agent registry | Trust checks and private/team visibility rules exist. | Package signing, provenance, malware/prompt-injection review service. |
| Mac release | Electron build and smoke are local. | Signed/notarized macOS artifact tested on a clean external Mac. |
| Security | ROX-owned abuse paths have regression tests. | Dependency audit, public penetration test, hosted infra hardening. |

## 3. UX Limitations

- The visual system is coherent enough for RC, but not every route has
  screenshot-driven regression coverage.
- Game/Arena intensity is deliberately restrained. The priority was shared
  truth and evidence-backed progression.
- Global HUD wiring proves a shared runtime projection path; full persisted
  app-wide hydration is still a later production integration task.
- Some secondary settings/legal/support surfaces remain MVP-quality.

## 4. E2E Limitations

The current e2e story is fake-provider-safe and local:

```text
runtime event journey
  + core scenario validators
  + Electron smoke
  + build/typecheck/lint/test gates
```

Not covered as live external e2e:

- real LLM execution;
- real public share URL from a remote browser;
- real email verification inbox;
- real payment webhook settlement;
- real S3/R2/MinIO object lifecycle;
- real 24-hour worker mission;
- signed/notarized app launch on a clean external machine.

## 5. Security Limitations

Current checks fail closed for:

- mission completion without stored artifact and passing gate evidence;
- VDI spoofing through paid capacity;
- package install/fork without trust evidence;
- public/share payload secrets;
- malformed provider output;
- duplicate/replayed runtime events.

Still required before public launch:

- dependency audit and accepted-risk register;
- production CSP and public viewer hardening;
- provider credential rotation plan;
- tenant isolation tests against the production persistence adapter;
- external security review of account/share/session flows.

## 6. Operational Limitations

- Push depends on remote auth and runtime policy.
- Private artifact upload depends on configured private CI credentials.
- Local runtime files must stay uncommitted:

```text
events.jsonl
.claude/
```
