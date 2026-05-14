# T365 - RC R9 Legal Preserve Audit Allowlist

## 1. Task Summary

Repair the single R.9 community-link audit failure in the current T363 full
suite without weakening the community-link audit.

## 2. Repo Context Discovered

The R.9 audit scans tracked files for upstream community-implying URLs outside
whole-file, prefix, and line-level allowlists. The failure is not a demo link or
support/community destination; it is the M.3 release audit row that records the
legal-preserve upstream attribution URL required until R.11.

## 3. Files Inspected

- `scripts/__tests__/community-link-audit.test.ts`
- `docs/release/m3-upstream-merge-audit.md`
- `docs/tickets/T365-rc-r9-legal-preserve-audit-allowlist.md`
- `docs/worklog/T365-rc-r9-legal-preserve-audit-allowlist.md`

## 4. Tests Added First

No new test file was needed. The existing R.9 audit test is the regression
contract and was run before implementation:

```bash
bun test scripts/__tests__/community-link-audit.test.ts
```

## 5. Expected Failing Test Output

Observed before implementation:

```text
docs/release/m3-upstream-merge-audit.md:34 [upstream-repo-tab] | Local legal-preserve attribution URL | `https://github.com/lukilabs/craft-agents-oss` (README §License; immutable until R.11) |

2 pass
1 fail
```

## 6. Implementation Changes

- Added a line-level `upstream-repo-tab` allowlist for the exact
  `Local legal-preserve attribution URL` table row containing
  `https://github.com/lukilabs/craft-agents-oss`.
- Did not whole-file allowlist `docs/release/m3-upstream-merge-audit.md`.

## 7. Validation Commands Run

```bash
bun test scripts/__tests__/community-link-audit.test.ts
bun run validate:rebrand
bun run validate:docs
git diff --check
```

## 8. Passing Test Output Summary

- `bun test scripts/__tests__/community-link-audit.test.ts`: 3 pass, 0 fail,
  27 expect calls.
- `bun run validate:rebrand`: pass; no forbidden tokens outside the allowlist.
- `bun run validate:docs`: agent contract, architecture docs, and sync v2
  design validations pass.
- `git diff --check`: pass.

## 9. Build Output Summary

No build was run. This repair changes only a test allowlist and ticket/worklog
documentation.

## 10. Remaining Risks

- T363's broader full-suite failures remain after this isolated R.9 repair.
- The allowlist must stay line-level; whole-file allowlisting the M.3 audit
  would hide future community-link regressions in that document.

## 11. Acceptance Criteria Matrix

| Criterion | Status | Evidence |
|---|---|---|
| Targeted R.9 audit passes | Pass | Community-link audit: 3 pass, 0 fail |
| Allowlist is line-level and legal-preserve specific | Pass | `lineAllowlist` matches the legal-preserve attribution row |
| `bun run validate:rebrand` passes | Pass | Validator exits 0 |
| `git diff --check` passes | Pass | Whitespace check exits 0 |
