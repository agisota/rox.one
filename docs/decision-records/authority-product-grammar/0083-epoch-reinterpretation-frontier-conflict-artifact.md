# Decision 0083: Epoch Reinterpretation Frontier Conflict Artifact

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
if one lineage has:
  2_or_more unsuperseded frontier origins

this means:
  disputed canonical state
  not plural canonical state

the system materializes:
  explicit frontier-conflict artifact

the artifact links:
  adopted reinterpretation lineage
  all conflicting frontier origins
  detector_or_resolver
  reason
  timestamp

until conflict is resolved:
  canonical read
  must expose conflict
  not silently collapse to single winner
```

## Why
- Preserves the single-current invariant while making frontier ambiguity explicit, inspectable, and resolution-driven.
