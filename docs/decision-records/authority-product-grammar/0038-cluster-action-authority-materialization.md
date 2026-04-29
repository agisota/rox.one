# Decision 0038: Cluster Action Authority Materialization

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
cluster_action_intent itself
is not authority

it materializes into:
  member dispositions
  bounded overrides
  execution-ready grants
as needed per member
```

## Why
- Keeps shared intent separate from the concrete authority artifacts that actually enable execution.
