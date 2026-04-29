# Decision 0102: Epoch Reinterpretation Current Origin Payload Shape Invariant Across Resolution Paths

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
current_origin payload shape is:
  invariant across canonicalization paths

this is true whether current frontier comes from:
  ordinary promotion
  conflict resolution without adoption
  conflict resolution plus adoption

current_origin payload does not add:
  frontier_conflict_artifact_id
  conflict_resolution_artifact_id
  adoption_artifact_id
  adopted_from_conflict flag
```

## Why
- Keeps present-state reads branch-free and minimal while leaving resolution history on the artifact side of the model.
