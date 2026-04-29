# Decision 0069: Epoch Reinterpretation Single Successor Invariant

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
for one interpretation node:
  at most one direct superseding child
  is allowed

if reinterpretation happens again:
  it must supersede
  the current chain tip

result:
  one linear effective-history path
  per reaffirmation
```

## Why
- Keeps the reinterpretation chain linear, makes current-effective lookup trivial, and prevents forked interpretation histories inside one reaffirmation.
