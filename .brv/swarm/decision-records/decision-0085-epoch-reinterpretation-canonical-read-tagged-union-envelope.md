# Decision 0085: Epoch Reinterpretation Canonical Read Tagged Union Envelope

status: accepted
date: 2026-04-25
source_file: /Users/marklindgreen/Projects/craft/craft/docs/decision-records/authority-product-grammar/0085-epoch-reinterpretation-canonical-read-tagged-union-envelope.md
domain: authority-product-grammar
kind: decision

## canonical
canonical read returns:
  tagged union envelope

the envelope includes:
  state_kind = current_origin | unresolved_conflict

consumer branches:
  by explicit kind
  not by field heuristics
  not by endpoint split

normal current origin state:
  and unresolved frontier conflict state
  share one schema-stable read contract

## rationale
Keeps the read contract stable while making downstream branching explicit and deterministic.