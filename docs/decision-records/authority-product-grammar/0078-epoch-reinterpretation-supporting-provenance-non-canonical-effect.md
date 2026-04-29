# Decision 0078: Epoch Reinterpretation Supporting Provenance Non Canonical Effect

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
supporting provenance reference
is:
  non-canonical evidence only

it does not:
  change canonical adopted_from origin
  participate in live resolution by itself

any canonical origin change requires:
  new explicit adoption artifact
  or conflict-resolution path artifact
```

## Why
- Keeps the evidence layer separate from the resolution layer so canonical semantics do not drift through supporting metadata alone.
