# Decision 0023: Bounded Override Visibility Materiality

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
bounded_override visibility:
  foreground when it materially changes
  what may happen now

  compact in the main flow
  full detail in inspect and history

material events:
  created
  consumed
  cancelled
  superseded
  expired
```

## Why
- Keeps temporary authority legible without flooding the foreground surface.
