# T313 - PR #329 CI smoke contract blockers

Status: TODO

## Summary

Restore the PR #329 merge gates after the focused PZD-10 artifact-panel branch
exposed two CI contract drifts:

- mac diag smoke validator still expected the old `/tmp/diag-launch.mjs` path
  after the workflow moved the Playwright script under `/tmp/pw/`.
- Cross-platform macOS launch smoke packages a dev build without the optional
  packaged Rox Design runtime payload, so it must use the explicit dev-smoke
  bypass instead of failing before launch proof starts.

## Acceptance Criteria

- `bun run validate:mac-diag-smoke-workflow` passes.
- `bun run validate:cross-platform-launch-workflow` passes and protects the
  dev-smoke Rox Design payload bypass.
- Registration coverage tests include artifact RPC channels and pass.
- `git diff --check` passes.
- PR #329 CI no longer fails on validate workflow-contract drift or macOS
  Sequoia dev-smoke payload verification.

