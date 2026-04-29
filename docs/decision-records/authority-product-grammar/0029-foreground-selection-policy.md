# Decision 0029: Foreground Selection Policy

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
foreground selection precedence:
  explicit user pin
  current unresolved foreground owner
  widest overlapping authority space
  highest blocking severity_or_breadth
  recency as final tiebreak

invariant:
  selection follows
  authority semantics
  not raw arrival order
```

## Why
- Keeps the canonical gate tied to the real authority problem, not queue mechanics.
