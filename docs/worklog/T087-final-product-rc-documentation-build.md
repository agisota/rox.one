# T087 - Final Product RC Documentation and Build Worklog

## 1. Task summary

Close the T074-T087 integration wave with a current RC evidence pack and final
local validation. The target is a private/local fake-provider-safe release
candidate, not a hosted SaaS launch.

## 2. Repo context discovered

- The branch is `mac/rox-production-ready-rc`.
- T074-T086 are already committed as scoped Lore commits.
- Existing release docs were partly stale and still referenced older branches
  such as `mac/rox-e2e-integration` and `mac/upstream-v0.9.1-rox-merge`.
- `docs/release/production-readiness-matrix-2026-05-06.md` and
  `docs/release/e2e-evidence-2026-05-06.md` were missing.
- Runtime-local files remain dirty and must not be staged:
  `events.jsonl` and `.claude/`.

## 3. Files inspected

- `AGENTS.md`
- `package.json`
- `docs/release/final-rc-2026-05-06.md`
- `docs/release/current-state-snapshot-2026-05-06.md`
- `docs/release/e2e-integration-plan-2026-05-06.md`
- `docs/release/known-limitations-2026-05-06.md`
- `docs/release/user-guide-mvp-2026-05-06.md`
- `docs/release/admin-guide-2026-05-06.md`
- `docs/worklog/T074-experience-runtime-store.md`
- `docs/worklog/T075-deep-missions-launch-flow.md`
- `docs/worklog/T076-mission-control-runtime-binding.md`
- `docs/worklog/T077-global-metrics-quest-engine.md`
- `docs/worklog/T078-agent-arena-forge-real-actions.md`
- `docs/worklog/T079-mission-mode-prompt-registry-provider-orchestration.md`
- `docs/worklog/T080-global-experience-hud-app-wide-integration.md`
- `docs/worklog/T081-visual-polish-motion-states-ux-coherence.md`
- `docs/worklog/T082-e2e-experience-journey.md`
- `docs/worklog/T083-rox-id-account-registration-production-fix.md`
- `docs/worklog/T084-public-share-shortlink-production-contract.md`
- `docs/worklog/T085-private-ci-cd-release-pipeline.md`
- `docs/worklog/T086-security-abuse-hardening.md`

## 4. Tests added first

No new runtime test was needed for T087 because this ticket is a release
documentation and validation evidence task. The validation gate is the full
existing RC command set.

## 5. Expected failing test output

Not applicable for documentation-only T087. The expected pre-change issue was
documentation drift:

```text
release docs reference older branches and do not include the final production
readiness matrix or e2e evidence document
```

## 6. Implementation changes

- Updated final RC documentation for T074-T087.
- Updated current state snapshot for the current branch and commit chain.
- Updated known limitations with explicit fake-provider/local-only boundaries.
- Rewrote the MVP user guide around real user flows.
- Rewrote the admin guide around validation, private CI, release, and security.
- Added production readiness matrix.
- Added e2e evidence report.
- Added this ticket and worklog.

## 7. Validation commands run

```bash
bun run validate:docs
bun run validate:agent-contract
bun run typecheck:all
bun test
bun run lint
bun run electron:build
bun run validate:ci
bun run validate:e2e-core-scenarios
bun run e2e:core
bun run electron:smoke
bun run validate:mac-arm-build-workflow
git diff --check
```

## 8. Passing test output summary

- `bun run validate:docs`: passed; agent contract, architecture docs, and
  sync-v2 design docs validated.
- `bun run validate:agent-contract`: passed; 11 skills, 88 tickets, 7 required
  docs.
- `bun run typecheck:all`: passed.
- `bun test`: passed; 4708 pass, 13 skip, 0 fail, 1 snapshot, 12060
  expectations across 396 files.
- `bun run lint`: passed with 0 errors and 3 existing React hook dependency
  warnings in `App.tsx` and `FreeFormInput.tsx`.
- `bun run validate:ci`: passed; contract, architecture, private release
  pipeline, dev/typecheck/shared/doc tools, and i18n checks passed.
- `bun run validate:e2e-core-scenarios`: passed.
- `bun run e2e:core`: passed; 5 fake-provider-safe core scenarios passed,
  including Electron startup smoke.
- `bun run electron:smoke`: passed; headless Electron startup reached ready
  markers and shut down cleanly.
- `bun run validate:mac-arm-build-workflow`: passed.
- `git diff --check`: passed with no whitespace errors.

The first full `bun test` run surfaced one unrelated timeout in
`extractPowerShellWriteTarget` and one stale Deep Missions assertion after T086
tightened finalization copy. The PowerShell test passed in targeted isolation;
the Deep Missions assertion was aligned to the stricter T086 message and the
full suite then passed.

## 9. Build output summary

- `bun run electron:build`: passed. Main, preload, renderer, resources, and
  assets built successfully.
- Vite emitted existing chunk-size warnings for large renderer bundles.
- SDK native binary staging verified
  `claude-agent-sdk-darwin-arm64` as `claude-agent-sdk-binary`, 205.9 MB.

## 10. Remaining risks

- The RC is private/local and fake-provider-safe. Real LLM, storage, email,
  payment, shortlink, marketplace, and public viewer providers remain production
  integration work.
- Electron build/smoke validates the local app path, not a signed/notarized
  macOS distribution on a clean external machine.
- Push may be blocked by remote auth or runtime policy; exact result must be
  recorded after the final commit.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
|---|---|---|
| Final RC doc updated | Pass | `docs/release/final-rc-2026-05-06.md` |
| Current snapshot updated | Pass | `docs/release/current-state-snapshot-2026-05-06.md` |
| Known limitations updated | Pass | `docs/release/known-limitations-2026-05-06.md` |
| User guide updated | Pass | `docs/release/user-guide-mvp-2026-05-06.md` |
| Admin guide updated | Pass | `docs/release/admin-guide-2026-05-06.md` |
| Production readiness matrix exists | Pass | `docs/release/production-readiness-matrix-2026-05-06.md` |
| E2E evidence exists | Pass | `docs/release/e2e-evidence-2026-05-06.md` |
| Final validation complete | Pass | Full T087 gate set passed |
| Commit exists | Pass | `1190514` |
