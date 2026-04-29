# Decision 0076: Epoch Reinterpretation Adopted From Origin Precedence

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
if both are available:
  source attempted reinterpretation artifact
  and adopted payload source

canonical adopted_from origin is:
  the attempted reinterpretation artifact

adopted payload source is used:
  only as fallback
  when source reinterpretation artifact is absent

remaining provenance:
  stays in supporting references
```

## Why
- Keeps lineage artifact-centric where an explicit artifact exists, while still supporting payload-only adoption cases without breaking the model.
