# Decision 0063: Reactivation Epoch Single Open Invariant

status: accepted
date: 2026-04-25
source_file: /Users/marklindgreen/Projects/rox/rox/docs/decision-records/authority-product-grammar/0063-reactivation-epoch-single-open-invariant.md
domain: authority-product-grammar
kind: decision

## canonical
for one stable decision_locus:
  at most one open reactivation_epoch may exist

while an epoch is open:
  additional reopen signals
  do not create a new epoch

they are interpreted as either:
  belonging to the same live interval
  or invalid duplicate reopen attempts

## rationale
Preserves clean ordinal semantics and prevents overlapping live-span ambiguity on a single locus.