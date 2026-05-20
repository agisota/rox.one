# T313 - PR #329 CI smoke contract blockers

## 1. Context

PR #329 is the focused PZD-10 / GitHub #271 artifact panel branch plus the T312
Electron typecheck baseline repair. After opening the PR, CI surfaced blockers
that were outside the artifact panel runtime itself:

- GitHub `validate` and CircleCI `validate` failed in
  `validate:mac-diag-smoke-workflow` because the validator required the stale
  `node /tmp/diag-launch.mjs` workflow text while the workflow now writes and
  runs `/tmp/pw/diag-launch.mjs`.
- GitHub `macOS Sequoia ARM64 packaged launch` failed before launch smoke while
  `electron:dist:dev:mac:arm64` ran `rox-design:payload:verify` and the optional
  packaged Rox Design payload manifest was absent.
- Code review found handler-registration coverage tests did not include the new
  artifact RPC channels.

## 2. Implementation changes

- Updated `scripts/validate-mac-diag-smoke-workflow.ts` to require the current
  `/tmp/pw/diag-launch.mjs` launch script path.
- Added `ROX_SKIP_ROX_DESIGN_PAYLOAD_VERIFY=1` only to the cross-platform macOS
  launch smoke job, where the goal is packaged app launchability rather than
  exercising packaged Rox Design.
- Updated `scripts/validate-cross-platform-launch-workflow.ts` so the dev-smoke
  payload bypass is guarded by the workflow contract.
- Added artifact RPC handler channels to Electron registration coverage tests.
- Added `electron.app.getPath` to the Electron registration-test mock because
  GUI preference handler registration now imports the auto-launch preference
  path helper.
- Removed trailing EOF whitespace from T312 docs reported by `git diff --check`.

## 3. Validation commands run

- `bun run validate:mac-diag-smoke-workflow`
  - Result: pass; Sonoma/Sequoia diag smoke workflow contract is wired and the
    validator now matches `/tmp/pw/diag-launch.mjs`.
- `bun run validate:cross-platform-launch-workflow`
  - Result: pass; cross-platform launch workflow contract now guards the
    macOS dev-smoke Rox Design payload bypass.
- `bun test apps/electron/src/main/handlers/__tests__/registration.test.ts apps/electron/src/main/handlers/__tests__/registration-profiles.test.ts`
  - Result: 4 pass, 0 fail, 8 expectations.
- `ROX_SKIP_ROX_DESIGN_PAYLOAD_VERIFY=1 bun run rox-design:payload:verify`
  - Result: expected dev-smoke skip path exercised.
- `git diff --check`
  - Result: pass.
- `bun run validate:ci`
  - Result: failed after passing workflow contracts, typechecks, shared tests,
    doc-tool smokes, audit smoke, and i18n parity; blocker was
    `lint:i18n:sorted` reporting 8 unsorted locale JSON files.
- `bun run sort-locales`
  - Result: sorted `de`, `en`, `es`, `hu`, `ja`, `pl`, `ru`, and `zh-Hans`
    locale JSON files via the repo script.
- `bun run lint:i18n:sorted`
  - Result: pass after sorting locales.
- `bun run validate:ci`
  - Result: pass after locale sorting. Verified workflow contracts, typechecks,
    shared tests, doc-tool smokes, audit smoke, i18n parity, sortedness, and
    coverage.

## 4. Remaining risks

- This does not claim full packaged Rox Design runtime coverage; it keeps the
  cross-platform smoke scoped to launchability. Release/package workflows remain
  responsible for payload coverage when Rox Design is exercised.
- PR #329 still needs the larger product-level follow-up that wires real
  chat/agent artifact production into `artifacts:upsert` and opens the panel
  from user-visible chat flow.
