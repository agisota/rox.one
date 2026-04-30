---
name: storage-quota-architect
description: Design S3-compatible storage, per-user/team quotas, object prefixes, and usage accounting.
---
# Storage Quota Architect

For storage:
1. Use object storage adapter interface.
2. Test quotas before uploads complete.
3. Test path traversal.
4. Test tenant isolation.
5. Test user 1GB default quota and team 10GB default quota.
6. Prefer prefixes/buckets abstraction; do not hardcode AWS-only logic.
