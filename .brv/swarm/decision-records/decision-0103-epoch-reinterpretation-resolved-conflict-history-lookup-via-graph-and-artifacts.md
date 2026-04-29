# Decision 0103: Epoch Reinterpretation Resolved Conflict History Lookup Via Graph And Artifacts

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
when consumer starts from:
  current_origin canonical read

and needs:
  resolved-conflict history
  adjudication path
  losing-side inspection

lookup proceeds via:
  origin graph relations
  provenance links on canonical origin
  linked mediation artifacts

the model does not define:
  dedicated reverse-resolution lookup field
  resolved-conflict backlink collection
  special post-resolution read variant
```

## Why
- Reuses the explicit graph-and-artifact model already established for present state, provenance, and audit history instead of creating a separate reverse-resolution surface.
