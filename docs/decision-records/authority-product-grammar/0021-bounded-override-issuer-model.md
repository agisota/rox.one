# Decision 0021: Bounded Override Issuer Model

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
bounded_override.issuer_model:
  every override has
  an explicit issuer

valid issuer classes:
  user
  operator_policy
  system_policy

invariant:
  non-user issuers retain
  inspectable provenance
  and authority basis
```

## Why
- Separates who granted temporary authority from what the override targets.
