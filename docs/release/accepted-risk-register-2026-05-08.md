# Accepted Risk Register - 2026-05-08

Branch: `mac/rox-production-ready-rc`
Scope: unresolved dependency advisories that would affect public production.

Current decision: no accepted public-production dependency risks are approved.

Public production remains blocked until every unresolved advisory is either
remediated, isolated behind production controls, or recorded here as a signed
accepted-risk decision with owner, expiration, compensating control, rollback
plan, and evidence.

## Required Fields

Any accepted-risk item must include all of the following fields before it can
support a public-production release decision:

| Field | Requirement |
|---|---|
| Risk ID | Stable release-local identifier. |
| Dependency/advisory | Package name, advisory family, or audit finding being accepted. |
| Affected path | Runtime or workflow path exposed to the risk. |
| Severity | Highest unresolved severity for the accepted finding. |
| Decision | `Accepted`, `Not accepted`, or `Expired`. |
| Owner | Named person or release role accountable for the decision. |
| Expires | Date when the acceptance must be re-reviewed. |
| Compensating control | Isolation, disablement, monitoring, input restriction, or other control. |
| Rollback plan | Concrete action to remove or disable the risky path. |
| Evidence | Links to audit output, tests, isolation proof, or signed release decision. |

## Current Items

| Risk ID | Dependency/advisory | Affected path | Severity | Decision | Owner | Expires | Compensating control | Rollback plan | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| AR-DEPENDENCY-AUDIT-2026-05-08 | Current `bun audit` findings from `dependency-risk-register-2026-05-08.md` | Messaging adapters, PI provider, document conversion, provider SDK paths | Critical | Not accepted | Unassigned | N/A | Public production remains blocked; T106/T107/T108/T110/T112 add local guards for known risky runtime surfaces | Keep public launch disabled until advisories are remediated, isolated, or signed acceptance is added | `docs/release/dependency-risk-register-2026-05-08.md`; `bun audit` |

## Acceptance Rules

- `Accepted` items require a signed release decision outside this register; this
  file records the release contract but is not itself a signature.
- `Accepted` items require an expiration date no later than the next release
  decision checkpoint.
- `Accepted` items require concrete production isolation evidence for externally
  reachable code paths.
- `Not accepted` items keep public production blocked.
- `Expired` items are treated as `Not accepted` until renewed with fresh
  evidence.

## Verification Commands

Use these commands when changing this register:

```bash
bun audit
bun test scripts/__tests__/dependency-risk-register-contract.test.ts
bun run validate:docs
git diff --check
```

## Exit Criteria

Public production can only use this register as release evidence when every
unresolved dependency advisory has either:

1. a clean remediation verified by `bun audit`;
2. a production isolation proof linked from the relevant risk item; or
3. a signed accepted-risk decision with owner, expiration, compensating control,
   rollback plan, and evidence.
