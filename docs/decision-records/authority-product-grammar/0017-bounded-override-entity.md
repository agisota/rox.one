# Decision 0017: Bounded Override Entity

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
bounded_override:
  separate entity
  not the same thing as armed_state

fields:
  target_action
  scope
  issuer
  expiry_or_one_shot_semantics
  reason_or_source
```

## Why
- Keeps local override authority distinct from global armed capability.
