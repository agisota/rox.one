# Decision 0044: Presentation Revision Triggers

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
gate_card.presentation_revision triggers when:
  summary changed
  member set changed
  recommended actions changed
  risk_or_blocking context changed
  pin_or_ordering context changed

but:
  underlying gate identity
  stays the same
```

## Why
- Lets the surface evolve without falsely implying a new authority problem.
