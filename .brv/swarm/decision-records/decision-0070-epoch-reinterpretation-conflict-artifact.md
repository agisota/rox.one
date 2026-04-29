# Decision 0070: Epoch Reinterpretation Conflict Artifact

status: accepted
date: 2026-04-25
source_file: /Users/marklindgreen/Projects/rox/rox/docs/decision-records/authority-product-grammar/0070-epoch-reinterpretation-conflict-artifact.md
domain: authority-product-grammar
kind: decision

## canonical
if a new epoch_reinterpretation
attempts to supersede
an already-superseded node:
  the chain is not rewritten

the system materializes:
  explicit epoch_reinterpretation_conflict artifact

artifact links:
  attempted superseded node
  current chain tip
  attempted new interpretation
  conflict reason
  issuer_or_system_source
  timestamp

## rationale
Preserves the linear-chain invariant while keeping conflicting reinterpretation intent inspectable for audit, debugging, and history.