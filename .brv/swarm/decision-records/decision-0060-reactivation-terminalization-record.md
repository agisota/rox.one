# Decision 0060: Reactivation Terminalization Record

status: accepted
date: 2026-04-25
source_file: /Users/marklindgreen/Projects/rox/rox/docs/decision-records/authority-product-grammar/0060-reactivation-terminalization-record.md
domain: authority-product-grammar
kind: decision

## canonical
locus_reactivation closes via:
  explicit reactivation_terminalization record

the record is the canonical inspectable reason:
  why the reactivation interval
  is no longer live

record links:
  reactivation artifact
  closing cause
  resolved_by artifact_or_state
  timestamp

parent state changes and child settlement:
  may coexist
  but are auxiliary_or_derived
  not the canonical close record

## rationale
Keeps reopen lifecycle symmetric, auditable, and resistant to hidden derived-close semantics.