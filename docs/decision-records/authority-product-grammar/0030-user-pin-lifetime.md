# Decision 0030: User Pin Lifetime

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
user pin persists until:
  user unpins
  pinned gate resolves
  pinned gate is superseded
  pinned foreground frame materially disappears
```

## Why
- Treats pinning as a durable focus instruction instead of a fragile UI gesture.
