# Decision 0045: Presentation Revision History Placement

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
presentation_revision history lives:
  inside gate_card inspect history

only material foreground transitions
also emit
top-level timeline events
```

## Why
- Prevents presentation churn from polluting the main action history.
