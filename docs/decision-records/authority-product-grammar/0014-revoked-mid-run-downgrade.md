# Decision 0014: Revoked Mid Run Downgrade

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
if armed lease is revoked mid-run:
  system downgrades authority explicitly
  instead of pretending the run is still armed
```

## Why
- Prevents false authority continuity during execution.
