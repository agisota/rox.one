# Decision 0061: Reactivation Epoch Artifact

status: accepted
date: 2026-04-25
source_file: /Users/marklindgreen/Projects/craft/craft/docs/decision-records/authority-product-grammar/0061-reactivation-epoch-artifact.md
domain: authority-product-grammar
kind: decision

## canonical
each reopened live-span of a decision_locus materializes as:
  explicit reactivation_epoch artifact

the artifact is the canonical inspectable span unit:
  for one reopened interval
  of the same locus

artifact links:
  locus
  opening locus_reactivation
  closing reactivation_terminalization
  ordinal
  started_at
  ended_at_or_open

## rationale
Makes repeated reopen cycles countable, comparable, and auditable without reconstructing spans from event inference.