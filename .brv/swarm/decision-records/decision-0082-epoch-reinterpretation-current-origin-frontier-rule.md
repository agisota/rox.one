# Decision 0082: Epoch Reinterpretation Current Origin Frontier Rule

status: accepted
date: 2026-04-25
source_file: /Users/marklindgreen/Projects/rox/rox/docs/decision-records/authority-product-grammar/0082-epoch-reinterpretation-current-origin-frontier-rule.md
domain: authority-product-grammar
kind: decision

## canonical
when origin-supersession chain exists:
  current canonical origin
  is the frontier origin node

frontier origin node means:
  origin not superseded
  by any fresher origin-supersession edge

with relation:
  fresh -> previous

current origin is:
  the origin
  that no fresher origin points beyond

## rationale
Makes current state derivable directly from the origin graph without replaying promotion artifacts or using ad hoc resolver behavior.