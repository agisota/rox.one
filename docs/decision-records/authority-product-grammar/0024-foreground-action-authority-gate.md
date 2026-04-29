# Decision 0024: Foreground Action Authority Gate

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
before any foreground action:
  evaluate authority_gate

authority_gate outcomes:
  allow
  allow-via-bounded-override
  require-decision-request
  block

invariant:
  no risky foreground action
  bypasses the gate surface
```

## Why
- Makes action authority a first-class evaluation step instead of an implicit side condition.
