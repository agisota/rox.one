# Decision 0001: Internal Stage Spine

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
internal_stage_spine:
  prepare
  act
  verify
  integrate
```

## Why
- Gives the system one stable internal execution model.
- Lets user-facing labels vary without changing execution semantics.
