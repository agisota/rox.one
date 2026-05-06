# Shared File Lock

This file records current ownership for the ROX production-ready RC integration
train. It prevents independent lanes from mutating shared files without an
explicit handoff.

| Area | Owner | Notes |
|---|---|---|
| `package.json` / `bun.lock` | integration lead | No dependency/script churn without explicit ticket need. |
| global CSS / design tokens | T081 | Do not edit during T074. |
| route registry / app navigation | T076/T080 | One owner at a time. |
| `packages/shared/src/workbench/` | T074/T077 | T074 owns runtime store/event bus now. |
| mission scheduler | T076 | T074 may reference contracts only. |
| provider gateway | T079 | T074 must stay fake-safe and not call providers. |
| account/session/share | T083/T084 | Do not edit during T074. |
| Experience screens | T075-T080 | T074 may add selectors, not visual polish. |
| CI files | T085 | Do not edit during T074. |
| security tests | T086 | T074 adds local integrity tests only. |
| release docs | T087 | T074 updates ticket/worklog only. |
