# Decision 0037: Cluster Action Intent Artifact

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
executing a shared cluster action
creates cluster_action_intent

cluster_action_intent records:
  target cluster
  selected action
  targeted member set snapshot
  issuer
  timestamp
```

## Why
- Preserves the user or system intent before it fans out into member-level consequences.
