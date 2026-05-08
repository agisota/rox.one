# T106 - Document Conversion Trust Boundary Worklog

## 1. Task summary

Add an explicit server-core trust-boundary guard around Office/document
conversion so the current private/local RC path cannot be silently reused for
public untrusted ingestion.

Initial state:

```text
## mac/rox-production-ready-rc...origin/mac/rox-production-ready-rc [ahead 8]
```

The ahead commits T098-T105 are locally complete. A history-safe push to
`origin/mac/rox-production-ready-rc` was attempted after verifying `origin` is
the private `agisota/rox-one-terminal` repo, but the Codex runtime blocked the
write command before Git executed it:

```text
approval required by policy, but AskForApproval is set to Never
```

## 2. Repo context discovered

- T104 dependency risk register classifies document conversion dependencies as
  public-production blockers.
- `packages/server-core/src/services/office-document-adapter.ts` owns the
  injected conversion seam.
- `packages/server-core/src/handlers/rpc/files.ts` calls the adapter during
  local workspace attachment storage.
- `packages/server-core/src/services/office-document-adapter.test.ts` already
  covers local conversion, empty output rejection, and content-safe error
  wrapping.

## 3. Files inspected

- `docs/release/dependency-risk-register-2026-05-08.md`
- `docs/worklog/T104-dependency-audit-risk-register.md`
- `packages/server-core/src/services/office-document-adapter.ts`
- `packages/server-core/src/services/office-document-adapter.test.ts`
- `packages/server-core/src/handlers/rpc/files.ts`
- `packages/server-core/src/handlers/rpc/files.test.ts`
- `apps/electron/resources/scripts/markitdown_cli.py`
- `apps/electron/resources/permissions/default.json`

## 4. Tests added first

Added a regression in
`packages/server-core/src/services/office-document-adapter.test.ts` proving a
`public-untrusted` conversion request rejects before invoking the converter:

```bash
bun test packages/server-core/src/services/office-document-adapter.test.ts
```

## 5. Expected failing test output

Red run before implementation:

```text
3 pass
1 fail
Expected substring: "Document conversion is disabled for public untrusted uploads"
Received message: "Failed to convert \"public-upload.xlsx\" to readable format: unexpected info log"
```

This showed the converter path was still reached and the success logger was
called, so the trust-boundary guard was missing.

## 6. Implementation changes

- Added `OfficeDocumentConversionTrust` with explicit
  `local-user-initiated` and `public-untrusted` values.
- Added a pre-converter adapter guard that rejects `public-untrusted`
  conversion and logs only the trust-boundary rejection, not document content.
- Marked the existing attachment storage Office conversion path as
  `local-user-initiated` in `packages/server-core/src/handlers/rpc/files.ts`.
- Did not change dependency manifests, dependency versions, or lockfiles.

## 7. Validation commands run

```bash
bun test packages/server-core/src/services/office-document-adapter.test.ts packages/server-core/src/handlers/rpc/files.test.ts
cd packages/server-core && bun run tsc --noEmit
bun run validate:docs
git diff --check
git diff --name-only | rg '(^|/)(package\.json|bun\.lock|bun\.lockb|pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$' || true
```

## 8. Passing test output summary

```text
7 pass
0 fail
20 expect() calls
Ran 7 tests across 2 files.
```

`server-core` typecheck exited 0.

Docs validation:

```text
[agent-contract] ok: 11 skills, 107 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated docs/architecture/sync-v2-design.md
```

`git diff --check` exited 0. The dependency manifest/lockfile name check
returned no modified dependency manifest or lockfile paths.

## 9. Build output summary

No build expected for this bounded server-core unit slice unless validation
evidence shows a wider runtime impact.

## 10. Remaining risks

- This ticket adds an explicit guardrail. It does not remediate the vulnerable
  transitive packages recorded in T104.
- Public production remains blocked until dependency remediation or signed
  accepted-risk approval plus isolation evidence and external security review.
- Remote push remains blocked by the current Codex runtime policy.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
|---|---|---|
| Public/untrusted conversion test fails before guard and passes after | Done | Red run failed before guard; targeted tests passed after guard |
| Public/untrusted conversion rejects before invoking converter | Done | Adapter test asserts `converterCalled` remains false |
| Existing local Office conversion behavior remains green | Done | RPC attachment storage test passed |
| Dependency manifests and lockfiles remain unchanged | Done | Manifest/lockfile name check returned no paths |
| Docs validation passes | Done | `bun run validate:docs` |
| Worklog complete | Done | This file |
| Scoped Lore commit exists | Done | This changeset commit |
