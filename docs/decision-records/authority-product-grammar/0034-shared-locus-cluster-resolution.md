# Decision 0034: Shared Locus Cluster Resolution

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
shared_locus_cluster resolves when:
  its shared authority question
  no longer requires
  open decision

requirements:
  all member requests reached
  terminal disposition

  no unresolved shared remainder
  remains live
```

## Why
- Separates cluster closure from downstream execution tails.
