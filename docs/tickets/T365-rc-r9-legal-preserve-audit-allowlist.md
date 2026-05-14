# T365 - RC R9 Legal Preserve Audit Allowlist

Status: Done

## Context

T363's full-suite evidence shows the R.9 community-link audit is still red. The
targeted test reproduces a single finding:

```text
docs/release/m3-upstream-merge-audit.md:34 [upstream-repo-tab]
| Local legal-preserve attribution URL |
`https://github.com/lukilabs/craft-agents-oss` (README §License; immutable until R.11) |
```

The line documents the Apache 2.0 legal-preserve attribution URL; it is not a
user-facing community link or demo browser tab.

## Goal

Keep the R.9 audit strict while allowing the specific legal-preserve release
audit row that documents immutable upstream attribution.

## TDD Requirements

1. Reproduce `bun test scripts/__tests__/community-link-audit.test.ts` red.
2. Add the narrowest allowlist possible for this legal-preserve row.
3. Re-run the targeted R.9 audit and rebrand validator.

## Implementation Requirements

- Do not whole-file allowlist `docs/release/m3-upstream-merge-audit.md`.
- Do not weaken non-ROX Discord/Twitter/X URL detection.
- Do not change legal-preserve attribution docs.

## Validation Commands

```bash
bun test scripts/__tests__/community-link-audit.test.ts
bun run validate:rebrand
bun run validate:docs
git diff --check
```

## Acceptance Criteria

- [x] `bun test scripts/__tests__/community-link-audit.test.ts` passes.
- [x] The allowlist is line-level and tied to the legal-preserve table row.
- [x] `bun run validate:rebrand` passes.
- [x] `git diff --check` passes.

## Worklog

Update `docs/worklog/T365-rc-r9-legal-preserve-audit-allowlist.md`.
