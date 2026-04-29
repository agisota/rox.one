# Decision 0028: Foreground Gate Concurrency

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
foreground_gate concurrency:
  at most one canonical foreground gate surface
  per decision frame

multiple requests may remain live
but only one owns
the immediate decision slot
```

## Why
- Avoids competing gate surfaces for the same user attention channel.
