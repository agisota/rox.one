# Decision 0105: Epoch Reinterpretation Current Origin Supersedes Origin Id Is Only Payload Transition Edge

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
current_origin payload transition edge is:
  supersedes_origin_id?
  only

this remains true across:
  ordinary promotion
  conflict resolution without adoption
  conflict resolution plus adoption

current_origin payload does not add:
  adopted_from_origin_id
  conflict_resolution_parent_id
  promotion_artifact_id
  other path-specific transition edge
```

## Why
- Keeps payload transition semantics origin-graph-native and path-invariant while leaving workflow-specific edges on artifacts.
