# Decision 0077: Epoch Reinterpretation Supporting Provenance Reference

status: accepted
date: 2026-04-25
source_file: /Users/marklindgreen/Projects/rox/rox/docs/decision-records/authority-product-grammar/0077-epoch-reinterpretation-supporting-provenance-reference.md
domain: authority-product-grammar
kind: decision

## canonical
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

## rationale
Preserves secondary provenance as inspectable, audit-stable structure without weakening the singular canonical origin rule.