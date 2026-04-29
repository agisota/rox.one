# Decision 0025: Gate Failure Decision Request

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
when authority_gate fails
and the action is recoverable:
  create decision_request
  not a generic runtime error

decision_request links:
  blocked action
  authority reason
  recommended options
  urgency_or_blocking_scope
```

## Why
- Presents missing authority as a resolvable decision problem, not an opaque failure.
