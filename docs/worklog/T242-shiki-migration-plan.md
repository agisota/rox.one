# T242 - Shiki Migration Plan

## 1. Task summary

Record the Phase 11 Shiki migration decision after PR #85 landed the adapter
code without its required ADR and ticket metadata. The plan chooses the curated
JS-regex adapter path, registers ADR 0010, and points implementation repair to
T336 because T243 is already used on `main` for RBAC property tests.

## 2. Repo context discovered

- The master roadmap's Phase 11 section requires selecting an option from the
  F.1 research doc and recording it in ADR 0010.
- The research doc itself was committed at `09c5fc1` under
  `.omc/research/F1-shiki-migration-research.md`; it is not present in the
  current working tree, so the branch uses `git show` to read the committed
  artifact.
- PR #85 merged the adapter code as a T172-labeled commit and left ADR 0010
  missing.
- PR #86 then used T243 for RBAC property tests, so this repair keeps T242 for
  the Shiki plan and uses T336 for the implementation metadata repair.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md`
- `docs/decision-records/audit-harness/README.md`
- `docs/decision-records/audit-harness/0008-audit-storage-backend.md`
- `git show 09c5fc1:.omc/research/F1-shiki-migration-research.md`
- `packages/shared/src/highlight/highlighter.ts`
- `packages/shared/src/highlight/languages.ts`
- `packages/shared/src/highlight/themes.ts`

## 4. Tests added first

No product test was added for this planning ticket. Repository validators are
the correct acceptance surface because the change is an ADR, ticket, and
worklog.

## 5. Expected failing test output

Before this repair, the branch had code comments pointing to ADR 0010 while
the file did not exist:

```text
test -f docs/decision-records/audit-harness/0010-shiki-highlighter.md
# exit 1
```

`validate:docs` also could not account for T242 because no ticket/worklog pair
existed.

## 6. Implementation changes

- Added `docs/decision-records/audit-harness/0010-shiki-highlighter.md`.
- Updated `docs/decision-records/audit-harness/README.md` with the ADR 0010
  accepted row.
- Added `docs/tickets/T242-shiki-migration-plan.md`.
- Added this worklog.

## 7. Validation commands run

Run after T242 and T336 were both present on the branch:

- `bun run validate:docs`
- `bun run validate:roadmap`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

Recorded during final PR validation:

```text
[agent-contract] ok
validate:roadmap OK
rebrand validation passed
git diff --check clean
```

## 9. Build output summary

No build is required for the planning artifact itself. Build evidence is
recorded in the T336 worklog because that ticket touches the adapter test.

## 10. Remaining risks

- ADR 0010 chooses the curated subset approach after the adapter has already
  landed. Follow-up call-site migration still has to prove the actual bundle
  benefit.
- Option A intentionally reduces future language picker breadth. Follow-up
  tickets must decide whether to keep, shrink, or dynamically load the picker
  for TipTap surfaces.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| ADR 0010 exists | PASS | `docs/decision-records/audit-harness/0010-shiki-highlighter.md` |
| ADR rejects non-selected options | PASS | ADR "Rejected Options" section |
| ADR register links ADR 0010 | PASS | `docs/decision-records/audit-harness/README.md` |
| T336 named as repair ticket | PASS | ADR follow-ups and ticket |
| Worklog complete | PASS | This 11-section file |
