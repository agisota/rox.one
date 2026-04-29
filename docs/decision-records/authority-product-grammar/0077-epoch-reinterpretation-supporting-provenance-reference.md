# Decision 0077: Epoch Reinterpretation Supporting Provenance Reference

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
when precedence selects:
  one canonical adopted_from origin

any non-selected provenance candidate
is preserved as:
  explicit supporting provenance reference

the supporting reference links:
  adopted reinterpretation node
  selected canonical origin
  non-selected provenance source
  support role or fallback reason
  timestamp
```

## Why
- Preserves secondary provenance as inspectable, audit-stable structure without weakening the singular canonical origin rule.
