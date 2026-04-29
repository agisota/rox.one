# Decision 0022: Bounded Override Source Types

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
bounded_override.source_type:
  explicit_user_decision
  persisted_user_setting
  operator_rule
  system_recovery_rule

invariant:
  source_type explains
  where the override came from

  issuer explains
  who owns it
```

## Why
- Prevents source provenance from collapsing into a generic issuer label.
