# Decision 0069: Epoch Reinterpretation Single Successor Invariant

status: accepted
date: 2026-04-25
source_file: /Users/marklindgreen/Projects/craft/craft/docs/decision-records/authority-product-grammar/0069-epoch-reinterpretation-single-successor-invariant.md
domain: authority-product-grammar
kind: decision

## canonical
for one interpretation node:
  at most one direct superseding child
  is allowed

if reinterpretation happens again:
  it must supersede
  the current chain tip

result:
  one linear effective-history path
  per reaffirmation

## rationale
Keeps the reinterpretation chain linear, makes current-effective lookup trivial, and prevents forked interpretation histories inside one reaffirmation.