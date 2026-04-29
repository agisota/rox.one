# Decision 0033: Shared Locus Cluster Placement

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
shared_locus_cluster:
  is the canonical foreground container
  when multiple requests share
  one authority question

cluster contains:
  member decision requests
  shared action surface
  aggregate blocking context

invariant:
  cluster is not
  an execution artifact
```

## Why
- Gives shared authority problems one canonical container instead of many parallel cards.
