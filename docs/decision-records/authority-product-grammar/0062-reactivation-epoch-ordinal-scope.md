# Decision 0062: Reactivation Epoch Ordinal Scope

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
reactivation_epoch.ordinal is:
  per decision_locus sequence

ordinal increments only:
  within one stable decision_locus

split descendants:
  start their own epoch sequence

superseding descendants:
  start their own epoch sequence

lineage links may exist:
  but do not share ordinal namespace
```

## Why
- Keeps epoch counting local, stable, and audit-friendly without lineage-wide renumbering semantics.
