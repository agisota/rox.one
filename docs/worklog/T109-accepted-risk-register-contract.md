# T109 - Accepted Risk Register Contract Worklog

## 1. Task summary

Add a release-level accepted-risk register contract so unresolved dependency
advisories cannot be treated as approved for public production without a
reviewable signed decision schema.

Initial state:

```text
## mac/rox-production-ready-rc...origin/mac/rox-production-ready-rc [ahead 11]
```

## 2. Repo context discovered

- `docs/release/dependency-risk-register-2026-05-08.md` says `bun audit` must
  pass cleanly or be paired with a signed accepted-risk register.
- `docs/release/production-readiness-matrix-2026-05-06.md` lists dependency
  remediation or signed accepted-risk approval as a public-production blocker.
- `scripts/__tests__/dependency-risk-register-contract.test.ts` only required
  the dependency risk register and matrix linkage before this ticket.
- No `docs/release/accepted-risk-register-2026-05-08.md` file existed before
  the red test.

## 3. Files inspected

- `scripts/__tests__/dependency-risk-register-contract.test.ts`
- `docs/tickets/T104-dependency-audit-risk-register.md`
- `docs/release/dependency-risk-register-2026-05-08.md`
- `docs/release/production-readiness-matrix-2026-05-06.md`
- `docs/release/known-limitations-2026-05-06.md`

## 4. Tests added first

Extended `scripts/__tests__/dependency-risk-register-contract.test.ts` before
adding the release document. The new contract requires:

- `docs/release/accepted-risk-register-2026-05-08.md`;
- the current no-accepted-risk public-production decision;
- required fields for any future accepted-risk approval;
- a not-accepted row for the live dependency audit blocker;
- links from the dependency risk register and production readiness matrix.

Red command:

```bash
bun test scripts/__tests__/dependency-risk-register-contract.test.ts
```

## 5. Expected failing test output

Initial red run before adding the accepted-risk register:

```text
1 pass
1 fail
14 expect() calls

Expected: true
Received: false
at scripts/__tests__/dependency-risk-register-contract.test.ts:50:42
```

## 6. Implementation changes

- Added `docs/release/accepted-risk-register-2026-05-08.md`.
- Defined required accepted-risk fields: risk ID, dependency/advisory,
  affected path, severity, decision, owner, expiration, compensating control,
  rollback plan, and evidence.
- Recorded the current live dependency audit blocker as
  `AR-DEPENDENCY-AUDIT-2026-05-08` with `Decision: Not accepted`.
- Linked the accepted-risk register from
  `docs/release/dependency-risk-register-2026-05-08.md`.
- Linked the accepted-risk register from the security row in
  `docs/release/production-readiness-matrix-2026-05-06.md`.

## 7. Validation commands run

```bash
bun test scripts/__tests__/dependency-risk-register-contract.test.ts
bun run validate:docs
git diff --check
git diff --name-only | rg '(^|/)(package\.json|bun\.lock|bun\.lockb|pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$' || true
```

## 8. Passing test output summary

Focused dependency-risk register contract:

```text
2 pass
0 fail
34 expect() calls
```

Docs validation:

```text
[agent-contract] ok: 11 skills, 110 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated docs/architecture/sync-v2-design.md
```

Diff and manifest hygiene:

```text
git diff --check: pass
package/lockfile diff check: no output
```

## 9. Build output summary

No build expected for this bounded release documentation contract unless docs or
focused tests show wider impact.

## 10. Remaining risks

- This ticket creates the accepted-risk contract; it does not accept any
  unresolved dependency risk for public production.
- Public production remains blocked until dependency remediation, production
  isolation evidence, or signed accepted-risk decisions exist for every
  unresolved advisory.
- External security review remains a separate public-production blocker.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
|---|---|---|
| Contract test fails before accepted-risk register/linkage and passes after | Done | Red failed on missing file; green focused test passes |
| Accepted-risk register exists with required approval fields | Done | `docs/release/accepted-risk-register-2026-05-08.md` |
| Current public-production dependency risk decision is explicitly not accepted | Done | `AR-DEPENDENCY-AUDIT-2026-05-08` row says `Not accepted` |
| Dependency risk register links to the accepted-risk register | Done | `docs/release/dependency-risk-register-2026-05-08.md` |
| Production readiness matrix links to the accepted-risk register | Done | `docs/release/production-readiness-matrix-2026-05-06.md` |
| Public-production blocked status remains explicit | Done | Accepted-risk register and dependency risk register both keep public production blocked |
| Dependency manifests and lockfiles remain unchanged | Done | Manifest/lockfile diff check returned no output |
| Docs validation passes | Done | `bun run validate:docs` passed |
| Worklog complete | Done | This file |
| Scoped Lore commit exists | Done | This commit |
