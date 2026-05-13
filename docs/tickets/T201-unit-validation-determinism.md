# T201 - Stabilize full unit validation

Status: DONE

## Summary

Make the full local and CI unit validation path deterministic after the final integration package handoff.

## Acceptance Criteria

- CI validation explicitly runs the repository contract checks and full unit suite.
- Full `bun run test:units` passes from a clean suite order.
- Electron tests do not leak partial DOM or Electron mocks into later test files.
- Server-core config tests do not leak partial shared config mocks into registration handlers.
- Legacy WebUI password verification remains scoped per server instance.
