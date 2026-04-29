# Decision 0032: Decision Request Dedup Merge

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
if multiple decision_requests ask
the same authority question
in the same canonical frame:
  dedup them into one shared_locus_cluster

preserve:
  member request lineage
  per-member status
  per-member execution links
```

## Why
- Avoids duplicated asks while retaining per-request accountability.
