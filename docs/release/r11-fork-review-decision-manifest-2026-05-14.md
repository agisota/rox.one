# R.11 Fork Review Decision Manifest - 2026-05-14

Status: OPERATOR FORK REVIEW MANIFEST

This report turns the live `fork-review` blocker into an operator-owned
acceptance decision. No fork-owner contact, expected-count override, tag
mutation, branch deletion, backup creation, `git filter-repo`, force-push, or
goal completion is authorized by this manifest.

No fork-owner contact, expected-count override, tag mutation, branch deletion, backup creation, `git filter-repo`, force-push, or goal completion is authorized by this manifest.

Source evidence:

```bash
gh api repos/agisota/rox-one-terminal/forks --jq 'length'
gh api repos/agisota/rox-one-terminal/forks --jq '.[] | {full_name, html_url, owner: .owner.login, default_branch, pushed_at}'
```

Related inventory:

- `docs/release/r11-fork-review-inventory-2026-05-14.md`

## Current Fork State

- Current fork count: 1
- Expected fork count: 0
- Gate row: `fork-review`
- Gate state: fail until the operator confirms the visible fork inventory is
  acceptable for destructive rewrite, or updates `ROX_R11_EXPECTED_FORKS`
  during an operator-controlled R.11 window.

Visible fork:

- Fork: `dofaromg/rox-one-terminal`
- Owner: `dofaromg`
- Default branch: `main`
- Last pushed: `2026-05-14T06:26:58Z`
- Disposition: operator-review-required

## Decision Options

| Option | Effect | Risk |
| --- | --- | --- |
| Accept the visible fork for the R.11 rewrite window | Lets the operator run preflight with `ROX_R11_EXPECTED_FORKS=1` | Requires explicit acknowledgement that fork owners may need coordination after force-push |
| Contact fork owner before destructive rewrite | May reduce downstream surprise | External coordination is outside this report-only lane |
| Keep expected fork count at 0 | Preserves the strict default policy | Keeps `fork-review` red |
| Defer fork decision until destructive window | Avoids premature policy change | Keeps default pre-backup gate red |

## Dry-run verification commands

Dry-run verification commands to run before any fork-count override:

```bash
gh api repos/agisota/rox-one-terminal/forks --jq 'length'
gh api repos/agisota/rox-one-terminal/forks --jq '.[] | {full_name, html_url, owner: .owner.login, default_branch, pushed_at}'
bun run rebrand:r11-preflight
```

Potential expected-count override shape, recorded only so an operator can
review the policy surface:

```bash
ROX_R11_EXPECTED_FORKS=1 bun run rebrand:r11-preflight
```

Do not set ROX_R11_EXPECTED_FORKS until an operator-owned destructive window is explicit.
Before that point, re-fetch the fork list and record the accepted fork policy
decision in the R.11 closeout evidence.

## R.11 Gate Impact

This manifest does not make `fork-review` pass. The default pre-backup gate
will remain red until an operator either accepts the visible fork count or the
GitHub fork state changes.
