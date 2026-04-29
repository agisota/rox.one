# Decision 0079: Epoch Reinterpretation Provenance Promotion Path Artifact

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
if later adjudication decides:
  a previously non-selected supporting provenance source
  should become new canonical origin

the supporting provenance source:
  does not self-promote

the system materializes:
  explicit provenance-promotion path artifact

the artifact links:
  adopted reinterpretation node
  previous canonical origin
  supporting provenance reference being promoted
  new canonical origin
  resolver_or_system_source
  reason_or_evidence
  timestamp
```

## Why
- Keeps canonical origin transitions append-only and inspectable instead of allowing silent promotion or mutation of prior provenance records.
