# Decision 0086: Epoch Reinterpretation Canonical Read Envelope Typed Payload

status: accepted
date: 2026-04-25
source_file: /Users/marklindgreen/Projects/craft/craft/docs/decision-records/authority-product-grammar/0086-epoch-reinterpretation-canonical-read-envelope-typed-payload.md
domain: authority-product-grammar
kind: decision

## canonical
canonical read envelope uses:
  shared top-level metadata
  plus single typed payload object

variant-specific data lives:
  only inside payload

payload schema is determined by:
  state_kind

top-level surface does not mix:
  shared metadata
  and variant-specific fields

## rationale
Keeps shared and variant concerns sharply separated and prevents top-level schema sprawl.