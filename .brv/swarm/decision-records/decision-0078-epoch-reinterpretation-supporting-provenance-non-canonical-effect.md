# Decision 0078: Epoch Reinterpretation Supporting Provenance Non Canonical Effect

status: accepted
date: 2026-04-25
source_file: /Users/marklindgreen/Projects/rox/rox/docs/decision-records/authority-product-grammar/0078-epoch-reinterpretation-supporting-provenance-non-canonical-effect.md
domain: authority-product-grammar
kind: decision

## canonical
supporting provenance reference
is:
  non-canonical evidence only

it does not:
  change canonical adopted_from origin
  participate in live resolution by itself

any canonical origin change requires:
  new explicit adoption artifact
  or conflict-resolution path artifact

## rationale
Keeps the evidence layer separate from the resolution layer so canonical semantics do not drift through supporting metadata alone.