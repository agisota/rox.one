# Decision 0010: Armed State Model

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
operator_grade:
  layered armed mode

scope layers:
  workspace ceiling
  thread-local arming
  explicit run armed state
```

## Why
- Separates global capability ceiling from local activation.
- Keeps elevated authority explicit and bounded.
