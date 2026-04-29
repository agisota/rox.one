# Decision 0082: Epoch Reinterpretation Current Origin Frontier Rule

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
when origin-supersession chain exists:
  current canonical origin
  is the frontier origin node

frontier origin node means:
  origin not superseded
  by any fresher origin-supersession edge

with relation:
  fresh -> previous

current origin is:
  the origin
  that no fresher origin points beyond
```

## Why
- Makes current state derivable directly from the origin graph without replaying promotion artifacts or using ad hoc resolver behavior.
