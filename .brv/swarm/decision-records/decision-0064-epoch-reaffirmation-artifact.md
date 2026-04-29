# Decision 0064: Epoch Reaffirmation Artifact

status: accepted
date: 2026-04-25
source_file: /Users/marklindgreen/Projects/craft/craft/docs/decision-records/authority-product-grammar/0064-epoch-reaffirmation-artifact.md
domain: authority-product-grammar
kind: decision

## canonical
additional reopen signals
while a reactivation_epoch is already open
materialize as:
  explicit epoch_reaffirmation artifact

artifact links:
  open reactivation_epoch
  signal source
  signal class
  timestamp
  interpretation:
    same_interval_reaffirmation
    invalid_duplicate_reopen

## rationale
Preserves the single-open invariant without losing repeated reopen signals needed for audit and debugging.