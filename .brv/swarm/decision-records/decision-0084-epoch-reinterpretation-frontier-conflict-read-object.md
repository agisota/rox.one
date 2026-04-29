# Decision 0084: Epoch Reinterpretation Frontier Conflict Read Object

status: accepted
date: 2026-04-25
source_file: /Users/marklindgreen/Projects/craft/craft/docs/decision-records/authority-product-grammar/0084-epoch-reinterpretation-frontier-conflict-read-object.md
domain: authority-product-grammar
kind: decision

## canonical
while frontier-conflict artifact is:
  unresolved

canonical read returns:
  explicit conflict read object
  not forged current origin

the read object includes:
  lineage id
  frontier-conflict artifact id
  conflicting frontier origin ids
  status = unresolved_conflict
  last_detected_at
  optional resolver_hint

## rationale
Keeps the read surface honest-by-construction and preserves deterministic downstream handling without inventing singular canonical state.