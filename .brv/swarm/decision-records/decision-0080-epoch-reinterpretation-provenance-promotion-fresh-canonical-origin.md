# Decision 0080: Epoch Reinterpretation Provenance Promotion Fresh Canonical Origin

status: accepted
date: 2026-04-25
source_file: /Users/marklindgreen/Projects/craft/craft/docs/decision-records/authority-product-grammar/0080-epoch-reinterpretation-provenance-promotion-fresh-canonical-origin.md
domain: authority-product-grammar
kind: decision

## canonical
after explicit provenance-promotion path artifact:
  the promotion artifact
  records the transition

the new canonical origin is:
  materialized as
  a fresh canonical origin node_or_artifact

historical supporting provenance reference:
  remains
  an input to the promotion
  not the canonical origin itself

## rationale
Keeps transition record and resulting canonical state separate, while avoiding retroactive mutation of supporting provenance records.