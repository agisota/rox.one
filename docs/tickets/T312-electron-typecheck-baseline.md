# T312 - Electron typecheck baseline blockers

Status: TODO

## Summary

Restore the Electron TypeScript baseline after the auto-launch settings merge so
PZD-10 / GitHub #271 can be verified without inheriting unrelated current-main
failures.

## Acceptance Criteria

- `bun run typecheck:electron` passes.
- The auto-launch preferences API is registered through the normal RPC channel
  map and classified as local-only app preference state.
- The settings menu schema covers the `behavior` settings page.
- Existing Rox Design partition tests compile without weakening runtime
  isolation assertions.
- Onboarding modal RTL tests use the current Vitest mock function type shape.
- PZD-10 artifact-panel targeted tests still pass.

