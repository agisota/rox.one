# T096 - Private RC Verification Stabilization

Status: DONE

## Goal

Close the private/local RC verification blockers that made the T094/T095
handoff misleading: config tests writing real user config, session watcher tests
depending on non-deterministic filesystem events, and Electron smoke requiring a
GUI-capable launch surface.

## Scope

- Make interceptor config tests hermetic without touching real `~/.rox`.
- Make session watcher tests deterministic through an injected watcher seam.
- Re-run targeted blockers and the full private RC validation matrix.
- Record current validation evidence in release docs and worklogs.
- Keep the RC fake-provider-safe and local/private only.

## Out of scope

- Real LLM/provider orchestration.
- Hosted workers, production DB, public viewer, shortlink, or object storage.
- ROX ID email verification provider.
- Payments, billing, or webhook reconciliation.
- Signing/notarization workflow implementation.
- External dependency/security audit execution.
- Bundle chunk splitting beyond the current read-only T092 baseline.

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Config tests use an isolated config directory and never write real `~/.rox/config.json` | DONE |
| Session watcher tests use deterministic watcher injection instead of OS event timing | DONE |
| `bun test` passes | DONE |
| `bun run electron:smoke` passes on a GUI-capable non-sandbox launch surface | DONE |
| Full private RC validation matrix passes | DONE |
| Release docs preserve public-production blockers | DONE |
| Runtime artifacts are excluded from staging | DONE |
| Scoped Lore commit exists | DONE |
