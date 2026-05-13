# Audit-Harness Decision Records

This directory holds architecture decision records for the audit-harness slice. Each ADR is a numbered, append-only document; numbers are reserved as work is scoped, and only `accepted`/`superseded` records carry final force. The current register:

| ADR | Title | Status |
|-----|-------|--------|
| 0001 | Audit-harness scope and verification surface | reserved |
| 0002 | Backend interface stability and refinement strategy | reserved |
| 0003 | SessionManager composition and lifecycle ownership | reserved |
| 0004 | [AgentRuntime as type refinement, surgical shared utilities](./0004-agentruntime-interface.md) | accepted |
| 0005 | [Storage tenancy and persistence boundary](./0005-storage-tenancy-contract.md) | accepted |
| 0006 | Permission-mode and authority resolution | reserved |
| 0007 | [Multi-tenant storage isolation](./0007-multi-tenant-storage-isolation.md) | accepted |
| 0009 | [RBAC policy](./0009-rbac-policy.md) | accepted |
| 0010 | [Shiki highlighter adapter](./0010-shiki-highlighter.md) | accepted |
| 0011 | [ROX.ONE rebrand canonical tokens](./0011-rox-one-rebrand-canonical-tokens.md) | accepted |

Reserved slots are placeholders for in-flight or planned work — the number is claimed so cross-references in code and other ADRs stay stable while the document is drafted. When a reserved slot is filled, replace its row with a link to the landed ADR and flip its status to `accepted`. Superseding decisions add a new ADR rather than rewriting an existing one; the old record's `Status` line is updated to `superseded by ADR-NNNN` and a back-link is added at the top of the new ADR.
