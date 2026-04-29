# Decision 0012: Armed Lease Lifetime

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
armed_lease.lifetime:
  layered
  explicit
  bounded
  invalidatable
```

## Why
- Prevents sticky elevated authority.
- Keeps revocation and expiry first-class.
