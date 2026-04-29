# Decision 0067: Epoch Reinterpretation Artifact

status: accepted
date: 2026-04-25
source_file: /Users/marklindgreen/Projects/craft/craft/docs/decision-records/authority-product-grammar/0067-epoch-reinterpretation-artifact.md
domain: authority-product-grammar
kind: decision

## canonical
if stored epoch_reaffirmation.interpretation
is later found to be wrong:
  the original epoch_reaffirmation
  remains immutable

the correction materializes as:
  explicit epoch_reinterpretation artifact

artifact links:
  original reaffirmation artifact
  prior interpretation
  new interpretation
  reason_or_evidence
  issuer_or_system_source
  timestamp

## rationale
Preserves audit-stable history and correction lineage without mutating the original adjudication record.