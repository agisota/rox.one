# Decision 0075: Epoch Reinterpretation Adopted From Single Origin

status: accepted
date: 2026-04-25
source_file: /Users/marklindgreen/Projects/rox/rox/docs/decision-records/authority-product-grammar/0075-epoch-reinterpretation-adopted-from-single-origin.md
domain: authority-product-grammar
kind: decision

## canonical
for one fresh adopted reinterpretation node:
  exactly one canonical adopted_from origin target
  is allowed

if more provenance context exists:
  it is attached
  via separate supporting references

canonical lineage:
  does not use
  multiple adopted_from parents

## rationale
Keeps provenance canonical and query-simple without introducing multi-parent ambiguity into the lineage graph.