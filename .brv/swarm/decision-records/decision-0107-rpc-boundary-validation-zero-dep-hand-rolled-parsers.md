# Decision 0107: RPC Boundary Validation Zero Dep Hand Rolled Parsers

- Status: accepted
- Date: 2026-05-14

## Canonical
```text
rpc handler input validation at server-core boundary uses:
  hand-rolled parse functions
  in _validators.ts local to the handlers directory

not:
  zod schemas
  external validation library

parse functions are:
  parseId(name, value)
  parseSlug(name, value)
  parseOptionalString(name, value)
  parseStringArray(name, value, opts)
  parseEnum(name, value, allowed)
  parseCreateLabelInput(value)

all parsers throw:
  Error & { code: 'INVALID_INPUT' }
  matching existing handler error contract

zod is present in @rox-one/shared
  but server-core does not depend on it
  introducing that dep edge is deferred to T052/T071
```

## Why
- server-core has no existing Zod dependency; adding it solely for boundary validation would introduce a new package edge without consensus across M.13 hardening scope (T052, T071 track that decision separately).
- Hand-rolled parsers cover the exact surface needed — path-traversal tokens, control characters, array length caps, enum allow-lists — without pulling in a schema-inference layer that the handlers do not otherwise use.
- The `INVALID_INPUT` error code aligns with the existing handler error contract, keeping error-handling paths uniform for callers.
