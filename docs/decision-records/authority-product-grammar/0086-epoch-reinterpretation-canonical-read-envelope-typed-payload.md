# Decision 0086: Epoch Reinterpretation Canonical Read Envelope Typed Payload

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
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
```

## Why
- Keeps shared and variant concerns sharply separated and prevents top-level schema sprawl.
