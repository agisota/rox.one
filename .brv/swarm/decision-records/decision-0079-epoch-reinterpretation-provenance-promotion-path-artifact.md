# Decision 0079: Epoch Reinterpretation Provenance Promotion Path Artifact

status: accepted
date: 2026-04-25
source_file: /Users/marklindgreen/Projects/craft/craft/docs/decision-records/authority-product-grammar/0079-epoch-reinterpretation-provenance-promotion-path-artifact.md
domain: authority-product-grammar
kind: decision

## canonical
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

## rationale
Keeps canonical origin transitions append-only and inspectable instead of allowing silent promotion or mutation of prior provenance records.