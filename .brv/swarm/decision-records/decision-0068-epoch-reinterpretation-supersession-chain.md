# Decision 0068: Epoch Reinterpretation Supersession Chain

status: accepted
date: 2026-04-25
source_file: /Users/marklindgreen/Projects/craft/craft/docs/decision-records/authority-product-grammar/0068-epoch-reinterpretation-supersession-chain.md
domain: authority-product-grammar
kind: decision

## canonical
for one epoch_reaffirmation:
  reinterpretations form
  explicit supersession chain

each epoch_reinterpretation explicitly supersedes:
  either the original interpretation
  or one prior reinterpretation artifact

the current effective interpretation is:
  the latest non-superseded node
  in that chain

## rationale
Keeps effective meaning audit-stable and prevents it from depending on implicit timestamp or authority heuristics.