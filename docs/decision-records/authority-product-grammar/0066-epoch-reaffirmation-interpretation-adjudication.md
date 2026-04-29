# Decision 0066: Epoch Reaffirmation Interpretation Adjudication

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
epoch_reaffirmation.interpretation is:
  explicit adjudicated outcome
  recorded at artifact creation

the stored interpretation is:
  the canonical inspectable result
  for how that signal
  was classified
  against the open epoch

heuristics source_dedup and trigger_mapping:
  may assist adjudication
  but are auxiliary_or_derived
  not the canonical result themselves
```

## Why
- Makes interpretation audit-stable on the artifact itself instead of leaving it as hidden or re-derived inference.
