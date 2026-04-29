# Decision 0106: Epoch Reinterpretation Current Origin Provenance Anchor And Supersession Edge Stay Orthogonal

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
in current_origin payload:
  canonical_source_ref
  and supersedes_origin_id?
  express different relations

canonical_source_ref denotes:
  immediate provenance source
  of the frontier origin

supersedes_origin_id? denotes:
  previous canonical frontier origin
  displaced by this frontier origin

the model does not collapse:
  provenance anchor into supersession edge
  supersession edge into provenance anchor
```

## Why
- Keeps source lineage and frontier replacement legible without overloading one payload field to mean both.
