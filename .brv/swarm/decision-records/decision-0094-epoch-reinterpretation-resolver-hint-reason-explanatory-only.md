# Decision 0094: Epoch Reinterpretation Resolver Hint Reason Explanatory Only

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
resolver_hint.reason, if present, is:
  explanatory
  optional
  non-branching

consumers branch:
  by resolver_hint.kind
  not by reason text

reason does not define:
  canonical action vocabulary
  additional hint kinds
  resolution authority
```

## Why
- Keeps machine semantics in `kind` and prevents explanatory text from becoming a second unstable contract surface.
