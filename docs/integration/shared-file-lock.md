# Shared File Lock

This file records temporary ownership for the ROX ONE e2e integration wave.
It is a coordination guard only; it does not change runtime behavior.

## Ownership Map

```text
package.json / bun.lock:
  owner: integration lead only

global CSS / design tokens:
  owner: T069 only

route registry / app navigation:
  owner: T068 or T069, one owner at a time

packages/shared schemas:
  owner: T066 for mission contracts, T067 can request changes

Electron main/preload bridge:
  owner: integration lead or explicit ticket owner

account/share/session code:
  frozen unless T071 finds security regression

Experience screen components:
  owner: T068 for state binding, T069 for visual polish after T068 contracts

CI files:
  owner: T070

security tests:
  owner: T071
```

## Merge Train

```text
T066 -> T067 -> T068 -> T069 -> T070 -> T071 -> T072
```

## Rules

- Shared files may have one owner at a time.
- Ticket branches must not stage unrelated runtime state.
- `events.jsonl`, `.claude/`, logs, caches, secrets, and generated local state are never part of this wave.
- T068 implementation starts only after T066 mission-store contracts are stable.
- T072 starts only after T066-T071 are merged and green.
