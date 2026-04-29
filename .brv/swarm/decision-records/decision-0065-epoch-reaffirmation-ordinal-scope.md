# Decision 0065: Epoch Reaffirmation Ordinal Scope

status: accepted
date: 2026-04-25
source_file: /Users/marklindgreen/Projects/rox/rox/docs/decision-records/authority-product-grammar/0065-epoch-reaffirmation-ordinal-scope.md
domain: authority-product-grammar
kind: decision

## canonical
epoch_reaffirmation.ordinal is:
  per reactivation_epoch sequence

ordinal increments only:
  within one reactivation_epoch

each new epoch:
  starts its own reaffirmation count

## rationale
Keeps reaffirmation numbering local to one reopened span and avoids leaking sequence semantics across epochs, loci, or sources.