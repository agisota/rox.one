# Decision 0058: Resolved Locus Reopen

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
resolved decision_locus reopens only when:
  the same authority question
  reactivates
  in the same canonical frame

common triggers:
  terminal disposition invalidated
  previously satisfied request reopened
  granted basis revoked or undone
  resolved remainder state became live again

otherwise:
  if the problem-space materially shifted
  create new_or_split locus instead
```

## Why
- Prevents reopen from swallowing materially new authority problems into stale frames.
