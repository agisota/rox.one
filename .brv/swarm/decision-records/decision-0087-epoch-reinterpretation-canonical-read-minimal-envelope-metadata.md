# Decision 0087: Epoch Reinterpretation Canonical Read Minimal Envelope Metadata

status: accepted
date: 2026-04-25
source_file: /Users/marklindgreen/Projects/rox/rox/docs/decision-records/authority-product-grammar/0087-epoch-reinterpretation-canonical-read-minimal-envelope-metadata.md
domain: authority-product-grammar
kind: decision

## canonical
canonical read envelope top-level must include:
  state_kind
  lineage_id
  read_model_version
  observed_at

this set is:
  minimal
  stable
  shared across all state variants

all non-shared data lives:
  in payload

## rationale
Keeps the envelope minimal while still supporting routing, lineage identity, tracing, and versioned consumers.