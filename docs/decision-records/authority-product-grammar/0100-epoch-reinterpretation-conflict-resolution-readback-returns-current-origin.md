# Decision 0100: Epoch Reinterpretation Conflict Resolution Readback Returns Current Origin

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
if frontier-conflict artifact is:
  resolved

canonical read returns:
  current_origin state
  not unresolved_conflict state

there is no separate:
  resolved_conflict read state
  conflict_resolution read state

resolved outcome is read through:
  canonical frontier binding
  plus linked resolution artifacts
  plus adoption artifact when present
```

## Why
- Preserves the closed tagged-union read contract and keeps resolution inspectable without introducing a third canonical read variant.
