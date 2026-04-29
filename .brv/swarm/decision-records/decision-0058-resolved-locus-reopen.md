# Decision 0058: Resolved Locus Reopen

status: accepted
date: 2026-04-25
source_file: /Users/marklindgreen/Projects/craft/craft/docs/decision-records/authority-product-grammar/0058-resolved-locus-reopen.md
domain: authority-product-grammar
kind: decision

## canonical
resolved decision_locus reopens only when:
  the same authority question
  reactivates
  in the same canonical frame

common triggers:
  terminal disposition invalidated
  previously satisfied request reopened
  granted basis revoked or undone
  resolved remainder state became live again

otherwise:
  if the problem-space materially shifted
  create new_or_split locus instead

## rationale
Prevents reopen from swallowing materially new authority problems into stale frames.