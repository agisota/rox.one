# Decision 0075: Epoch Reinterpretation Adopted From Single Origin

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
for one fresh adopted reinterpretation node:
  exactly one canonical adopted_from origin target
  is allowed

if more provenance context exists:
  it is attached
  via separate supporting references

canonical lineage:
  does not use
  multiple adopted_from parents
```

## Why
- Keeps provenance canonical and query-simple without introducing multi-parent ambiguity into the lineage graph.
