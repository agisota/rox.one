# Decision 0062: Reactivation Epoch Ordinal Scope

status: accepted
date: 2026-04-25
source_file: /Users/marklindgreen/Projects/rox/rox/docs/decision-records/authority-product-grammar/0062-reactivation-epoch-ordinal-scope.md
domain: authority-product-grammar
kind: decision

## canonical
reactivation_epoch.ordinal is:
  per decision_locus sequence

ordinal increments only:
  within one stable decision_locus

split descendants:
  start their own epoch sequence

superseding descendants:
  start their own epoch sequence

lineage links may exist:
  but do not share ordinal namespace

## rationale
Keeps epoch counting local, stable, and audit-friendly without lineage-wide renumbering semantics.