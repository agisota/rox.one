# Decision 0085: Epoch Reinterpretation Canonical Read Tagged Union Envelope

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
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
```

## Why
- Keeps the read contract stable while making downstream branching explicit and deterministic.
