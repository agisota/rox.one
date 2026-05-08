# T111 - Accepted Risk Guard Evidence Sync Worklog

## 1. Task summary

Keep accepted-risk release evidence aligned after T110 added a new
public-untrusted custom endpoint guard. This slice is evidence-only: no runtime
code, dependency version, package manifest, or lockfile changes are intended.

Initial state:

```text
## mac/rox-production-ready-rc...origin/mac/rox-production-ready-rc [ahead 13]
```

## 2. Repo context discovered

- `docs/release/dependency-risk-register-2026-05-08.md` now mentions T110 as a
  current hardening note.
- `docs/release/accepted-risk-register-2026-05-08.md` still lists only
  T106/T107/T108 in the current not-accepted dependency-audit row.
- Public production remains blocked because no unresolved public-production
  dependency risk is accepted.

## 3. Tests added first

Extended `scripts/__tests__/dependency-risk-register-contract.test.ts` before
updating the accepted-risk register. The new assertion requires the current
guard evidence sequence to include `T106/T107/T108/T110`.

Red command:

```bash
bun test scripts/__tests__/dependency-risk-register-contract.test.ts
```

## 4. Expected failing test output

Initial red run before updating the accepted-risk row:

```text
1 pass
1 fail
30 expect() calls

Expected to contain: "T106/T107/T108/T110"
Received: "... Public production remains blocked; T106/T107/T108 add local guards ..."
```

## 5. Implementation changes

- Updated the current `AR-DEPENDENCY-AUDIT-2026-05-08` not-accepted row in
  `docs/release/accepted-risk-register-2026-05-08.md` so the compensating
  control evidence references `T106/T107/T108/T110`.
- Kept the decision as `Not accepted`.
- Kept public production blocked.
- Did not change dependency manifests, package versions, or lockfiles.

## 6. Validation commands run

```bash
bun test scripts/__tests__/dependency-risk-register-contract.test.ts
bun run validate:docs
git diff --check
git diff --name-only | rg '(^|/)(package\.json|bun\.lock|bun\.lockb|pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$' || true
```

## 7. Passing test output summary

Focused dependency risk register contract:

```text
2 pass
0 fail
35 expect() calls
```

Docs validation:

```text
[agent-contract] ok: 11 skills, 112 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated docs/architecture/sync-v2-design.md
```

Diff hygiene:

```text
git diff --check: pass
package/lockfile diff check: no output
```

## 8. Remaining risks

- This ticket only keeps release evidence current. It does not remediate any
  `bun audit` findings or approve public-production dependency risk.

## 9. Acceptance criteria matrix

| Criteria | Status | Evidence |
|---|---|---|
| Contract test fails before accepted-risk evidence sync and passes after | Done | Red failed on missing `T106/T107/T108/T110`; green focused contract passes |
| Accepted-risk row references T106/T107/T108/T110 guard evidence | Done | `docs/release/accepted-risk-register-2026-05-08.md` |
| Current dependency risk remains `Not accepted` | Done | Accepted-risk row decision unchanged |
| Public production remains blocked | Done | Accepted-risk register and dependency risk register language unchanged |
| Dependency manifests and lockfiles remain unchanged | Done | Manifest/lockfile diff check returned no output |
| Docs validation passes | Done | `bun run validate:docs` |
| Worklog complete | Done | This file |
| Scoped Lore commit exists | Done | This commit |
