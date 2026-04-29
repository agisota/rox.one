# Decision 0026: Decision Request States

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
decision_request active states:
  foreground
  background

decision_request terminal states:
  satisfied
  cancelled
  superseded
  expired
```

## Why
- Separates foreground ownership from terminal disposition.
