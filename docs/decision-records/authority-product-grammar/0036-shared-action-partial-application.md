# Decision 0036: Shared Action Partial Application

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
if a shared cluster action
can apply only to a subset:
  record partial application explicitly
  apply to eligible members
  keep unresolved remainder live

invariant:
  partial application does not masquerade
  as full cluster resolution
```

## Why
- Prevents partial progress from being misread as total closure.
