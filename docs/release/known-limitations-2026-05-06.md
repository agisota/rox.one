# ROX ONE Agent Workbench - Known Limitations

Date: 2026-05-06
Branch: `mac/rox-e2e-integration`

## 1. Release Scope

This build is a local/private release candidate. It is not yet a production SaaS
launch.

The current product is intentionally fake-provider-safe:

```text
deterministic fake providers
  -> tested contracts
  -> validated UI/domain behavior
  -> future real provider adapters
```

## 2. Production Blockers

| Area | Current state | Needed for production |
|---|---|---|
| LLM/provider runtime | Provider gateway and fake providers exist. | Real adapter wiring, credentials, rate limits, observability, retries, billing attribution. |
| Public share shortlinks | `ShareProvider` seam, sanitizer, and URL validation exist. | Production viewer backend, persistent object storage, revocation, abuse controls, public uptime checks. |
| Email verification | UI models pending verification correctly. | Production email provider, deliverability monitoring, resend/rate-limit controls. |
| Payment settlement | Billing ledger contracts and deterministic tests exist. | Real payment provider, webhook signature checks, reconciliation, chargeback/refund handling. |
| Object storage | Storage contracts and quota tests exist. | Production S3/R2/MinIO adapter, lifecycle policy, backup, retention, scan controls. |
| Long-running missions | Durable scheduler contracts and fake recovery tests exist. | Production queue/worker deployment, restart recovery in deployed environment, user notifications. |
| Agent registry | Team/private trust checks exist. | Production registry service, package signing, malware/prompt-injection review pipeline. |
| Signed release | Electron build passes locally. | Signed and notarized macOS artifact plus private artifact retention policy. |
| Dependency security | Application security tests cover ROX-owned logic. | Dependency audit remediation or accepted risk register before public release. |

## 3. UX Limitations

- Some Workbench and Experience screens remain MVP-dense rather than fully
  product-complete.
- Game/Arena presentation is intentionally restrained in the RC; the shared
  truth model was prioritized over decorative mechanics.
- Some empty states are polished, but every edge state has not yet gone through
  screenshot-based visual QA.
- The account screen models registration-pending correctly, but a real external
  email verification roundtrip is not exercised by automated tests.

## 4. E2E Limitations

Current automated e2e coverage is fake-provider-safe and focuses on core
contracts:

```text
composer artifact flow
account/team/billing/storage contracts
server smoke
Electron startup smoke
```

Not yet covered as true live external e2e:

- real public shortlink opened from a remote browser;
- real email verification inbox;
- real payment webhook settlement;
- real S3 object lifecycle;
- real 24h wall-clock mission on a durable production worker;
- signed/notarized app launch on a clean external Mac.

## 5. Security Limitations

ROX-owned abuse paths hardened in T071:

- invalid/negative mission costs cannot increase budget;
- invalid branch expansion inputs fail closed;
- public/share/account/provider payloads redact sensitive keys and high-risk
  secret-like strings;
- paid capacity cannot satisfy quality/evidence gates.

Still required before public launch:

- dependency audit remediation;
- production CSP / public viewer hardening;
- provider credential rotation plan;
- signed package registry and package provenance checks;
- production tenant-isolation test suite against a real database adapter;
- external penetration test of share/session/account flows.

## 6. Operational Limitations

- Release artifacts are not uploaded by default in this RC unless the private
  release environment provides the required credentials.
- Push to GitHub can be blocked by local runtime/policy or missing remote auth.
  A local commit is the source of truth until push evidence exists.
- The repository still contains local runtime artifacts that must not be staged:

```text
events.jsonl
.claude/
```

## 7. Product North Star Still Open

The intended final product remains:

```text
raw prompt
  -> clarification / rewrite
  -> contextual option graph
  -> executable spec
  -> mission plan
  -> parallel agents
  -> artifacts
  -> review board
  -> verified deliverable
  -> VDI-backed progression
```

The RC proves the local contracts and the main screen surfaces. The next
production wave must connect real providers and hosted persistence.
