---
name: cloud-sync-architect
description: Design and test local-cloud sync, snapshots, conflicts, and workspace replication.
---
# Cloud Sync Architect

For sync:
1. Do not assume transparent sync first.
2. Prefer MVP snapshot/push/pull with explicit conflict detection.
3. Write tests for idempotency, conflict detection, deleted files, renamed files, stale local state, and failed network.
4. Never overwrite user data silently.
