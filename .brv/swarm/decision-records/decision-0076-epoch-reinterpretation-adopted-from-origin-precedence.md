# Decision 0076: Epoch Reinterpretation Adopted From Origin Precedence

status: accepted
date: 2026-04-25
source_file: /Users/marklindgreen/Projects/craft/craft/docs/decision-records/authority-product-grammar/0076-epoch-reinterpretation-adopted-from-origin-precedence.md
domain: authority-product-grammar
kind: decision

## canonical
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

## rationale
Keeps lineage artifact-centric where an explicit artifact exists, while still supporting payload-only adoption cases without breaking the model.