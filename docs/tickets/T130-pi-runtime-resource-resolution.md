# T130 - Pi runtime resource resolution

Status: DONE

## Summary

Fix local Electron PI runtime startup by staging generated helper servers into Electron resources and resolving packaged resource paths correctly.

## Acceptance Criteria

- `pi-agent-server` and `session-mcp-server` are staged into Electron resources during build.
- `resolveServerPath()` checks packaged Electron resource candidates.
- Electron desktop hosts default PI dependency risk to `private-local` unless explicitly overridden.
- Fresh Electron launch no longer reports `piServerPath not configured`.
- Targeted runtime resolver tests, Electron lint/typecheck, and Electron build pass.
