# Decision 0067: Epoch Reinterpretation Artifact

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
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
```

## Why
- Preserves audit-stable history and correction lineage without mutating the original adjudication record.
