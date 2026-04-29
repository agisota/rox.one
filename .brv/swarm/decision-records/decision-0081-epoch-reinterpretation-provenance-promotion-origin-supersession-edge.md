# Decision 0081: Epoch Reinterpretation Provenance Promotion Origin Supersession Edge

status: accepted
date: 2026-04-25
source_file: /Users/marklindgreen/Projects/rox/rox/docs/decision-records/authority-product-grammar/0081-epoch-reinterpretation-provenance-promotion-origin-supersession-edge.md
domain: authority-product-grammar
kind: decision

## canonical
after promotion creates:
  fresh canonical origin node

the fresh canonical origin:
  explicitly links to
  previous canonical origin
  through directional origin-supersession relation

promotion artifact:
  remains
  mediation_and_evidence record
  not the only place where origin lineage is reconstructed

## rationale
Keeps origin lineage directly queryable on origin nodes while preserving the promotion artifact as a separate transition record.