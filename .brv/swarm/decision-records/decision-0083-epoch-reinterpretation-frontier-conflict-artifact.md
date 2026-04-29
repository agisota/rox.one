# Decision 0083: Epoch Reinterpretation Frontier Conflict Artifact

status: accepted
date: 2026-04-25
source_file: /Users/marklindgreen/Projects/craft/craft/docs/decision-records/authority-product-grammar/0083-epoch-reinterpretation-frontier-conflict-artifact.md
domain: authority-product-grammar
kind: decision

## canonical
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

## rationale
Preserves the single-current invariant while making frontier ambiguity explicit, inspectable, and resolution-driven.