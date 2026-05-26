# T551 — Rox Design native surface integration

Status: DONE

## Problem
Rox Design currently reads as a nested foreign application inside ROX: the route keeps the intermediate navigator panel, the embedded runtime shows upstream tab chrome, English labels, and a small zoom scale that does not match ROX typography.

## Acceptance Criteria
- The `design` route suppresses the intermediate navigator panel so Rox Design uses the main workspace surface next to the global sidebar.
- `RoxDesignPage` does not render an extra React header above the native Electron view while the runtime is running.
- Embedded runtime copy uses `Rox Design`, not `Open Design`, for user-visible branding.
- Upstream mode tabs are hidden from the top of the embedded runtime and exposed through a ROX-styled bottom-left mode menu.
- Common user-visible embedded labels are translated to Russian.
- The embedded runtime zoom factor is large enough to match ROX text scale on full-width surfaces.
- Focused tests cover shell policy, host layout, skin/menu, translation, and zoom behavior.

## Non-goals
- Do not modify vendored files under `apps/electron/resources/rox-design`.
- Do not rebuild Rox Design as a native React module in this ticket.
- Do not add new dependencies.
