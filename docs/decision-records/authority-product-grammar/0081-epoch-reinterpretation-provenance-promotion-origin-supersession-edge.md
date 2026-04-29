# Decision 0081: Epoch Reinterpretation Provenance Promotion Origin Supersession Edge

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
after promotion creates:
  fresh canonical origin node

the fresh canonical origin:
  explicitly links to
  previous canonical origin
  through directional origin-supersession relation

promotion artifact:
  remains
  mediation_and_evidence record
  not the only place where origin lineage is reconstructed
```

## Why
- Keeps origin lineage directly queryable on origin nodes while preserving the promotion artifact as a separate transition record.
