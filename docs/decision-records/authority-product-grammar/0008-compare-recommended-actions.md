# Decision 0008: Compare Recommended Actions

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
compare.recommended_actions:
  keep current
  promote candidate_or_revision
  repin primary result
  continue evaluation
  reject candidate
  abandon candidate
```

## Why
- Gives compare a small canonical action vocabulary.
- Keeps recommendation semantics operational.
