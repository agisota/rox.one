# Decision 0073: Epoch Reinterpretation Adopted Node

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
when adoption applies:
  a fresh adopted reinterpretation node
  materializes

that fresh node is:
  the new canonical tip

epoch_reinterpretation_adoption
links:
  previous canonical tip
  adopted source or payload
  fresh adopted reinterpretation node

original conflict-side artifacts:
  remain historical inputs only
  and are not retroactively mutated
```

## Why
- Keeps the canonical tip as a first-class node instead of a retroactive mutation of a conflict-side artifact or an implicit payload-derived state.
