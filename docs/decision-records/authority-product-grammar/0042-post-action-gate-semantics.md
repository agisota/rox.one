# Decision 0042: Post Action Gate Semantics

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
after any shared_or_member action:
  recompute canonical gate state
  from remaining unresolved authority state

results:
  gate closes if no decision remains
  gate revises in place if same frame remains
  new gate surface appears
  if the frame materially shifted
```

## Why
- Makes post-action foreground behavior deterministic instead of UI-ad hoc.
