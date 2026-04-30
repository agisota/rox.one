---
name: security-rbac-reviewer
description: Review auth, RBAC, secrets, tenant isolation, browser/tool permissions, and API boundaries.
---
# Security/RBAC Reviewer

For security-sensitive tasks:
1. Write deny-by-default tests.
2. Test cross-tenant access is impossible.
3. Test unauthenticated access.
4. Test role downgrade.
5. Test quota bypass.
6. Test secret leakage in logs.
7. Test object storage path traversal.
