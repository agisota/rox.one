# Decision 0006: Result Revision Model

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
result:
  stable identity

result_revision:
  immutable
  states:
    draft
    current-candidate
    current
    superseded
    abandoned
    rejected
```

## Why
- Separates object identity from revision lifecycle.
- Prevents mutable-history ambiguity.
