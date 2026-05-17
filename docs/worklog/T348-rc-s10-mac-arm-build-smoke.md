# T348 - RC Scenario S10 Mac ARM Build Smoke Closeout

## 1. Task Summary

Close the stale `Todo` RC S10 Mac ARM build smoke ticket with current hosted
Mac ARM CI evidence from `main`.

## 2. Repo Context Discovered

`docs/tickets/T348-rc-s10-mac-arm-build-smoke.md` still carried the original
manual-clean-Mac acceptance shape, while the current repo has a hosted Mac ARM
pipeline that packages ROX.ONE, runs packaged headless smoke, runs Electron
startup smoke, validates packaged artifacts, and validates the private Mac
release trust boundary.

The current `main` head is
`346911fd11ef278d65bcfb750aa44eb400e47cea`.

## 3. Files Inspected

- `.github/workflows/mac-arm-build.yml`
- `scripts/validate-mac-arm-build-workflow.ts`
- `scripts/electron-smoke-packaged-mac.ts`
- `scripts/electron-smoke.ts`
- `scripts/validate-mac-private-release-boundary.ts`
- `scripts/validate-packaged-artifacts.ts`
- `docs/tickets/T348-rc-s10-mac-arm-build-smoke.md`
- `docs/release/2026-05-14-rc-evidence.md`

## 4. Tests Added First

No new test file was added. This is a validation/evidence closeout. The
existing Mac ARM workflow contract validator and hosted `mac-arm-build` job are
the relevant checks for this ticket.

## 5. Expected Failing Test Output

Not applicable for a docs/evidence closeout. The stale state was documentary:
the ticket and RC evidence table still said `Todo` after hosted Mac ARM smoke
had become a passing CI gate.

## 6. Implementation Changes

- Marked T348 `Status: DONE`.
- Added a resolution section tying the closeout to CircleCI `mac-arm-build`
  build 561 on `main`.
- Updated the S10 row in the RC evidence table to `Pass`.
- Preserved the production-signing distinction: hosted private/ad-hoc Mac ARM
  smoke is not the same as final public notarized release evidence.

## 7. Validation Commands Run

```text
$ bun run validate:mac-arm-build-workflow
[mac-arm-build-workflow] ok: Mac ARM workflow contract passed

$ gh api repos/agisota/rox-one-terminal/commits/346911fd11ef278d65bcfb750aa44eb400e47cea/status
ci/circleci: mac-arm-build success https://circleci.com/gh/agisota/rox-one-terminal/561

$ CircleCI build 561 public API snapshot
branch main
revision 346911fd11ef278d65bcfb750aa44eb400e47cea
status success
outcome success
job mac-arm-build

$ bun run validate:agent-contract
[agent-contract] ok: 11 skills, 492 tickets, 7 required docs

$ bun run validate:docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated docs/architecture/sync-v2-design.md

$ bun run validate:rebrand
rebrand validation passed: no forbidden tokens outside the allowlist

$ bun run validate:roadmap
validate:roadmap OK - 46 phases, 110 tickets across detail files

$ git diff --check
<no output>
```

## 8. Passing Test Output Summary

CircleCI `mac-arm-build` build 561 succeeded on `main`. Successful step names
included:

- `Validate Mac ARM workflow contract`
- `Typecheck all packages`
- `Check i18n parity`
- `Build Electron app`
- `Package ROX ONE for macOS ARM64`
- `Smoke packaged ROX ONE app`
- `Smoke Electron startup path`
- `Validate packaged artifact metadata`
- `Validate private mac release trust boundary`
- `Uploading artifacts`

## 9. Build Output Summary

Hosted Mac ARM CI packaged and uploaded the Mac ARM artifacts from commit
`346911fd11ef278d65bcfb750aa44eb400e47cea`.

## 10. Remaining Risks

Public production notarization and a human screenshot on a physical clean Mac
remain final release-operator evidence. This ticket only closes the automated
private/ad-hoc RC smoke evidence.

## 11. Acceptance Criteria Matrix

| Criterion | Status | Evidence |
|---|---|---|
| Mac ARM workflow contract passes | Pass | `bun run validate:mac-arm-build-workflow` |
| Electron build completes on Mac ARM | Pass | CircleCI build 561 step `Build Electron app` |
| Mac ARM artifact packaging completes | Pass | CircleCI build 561 step `Package ROX ONE for macOS ARM64` |
| Packaged app smoke passes | Pass | CircleCI build 561 step `Smoke packaged ROX ONE app` |
| Electron startup smoke passes | Pass | CircleCI build 561 step `Smoke Electron startup path` |
| Packaged artifacts are validated | Pass | CircleCI build 561 step `Validate packaged artifact metadata` |
| Private Mac trust boundary validated | Pass | CircleCI build 561 step `Validate private mac release trust boundary` |
| RC evidence row updated | Pass | `docs/release/2026-05-14-rc-evidence.md` S10 row |
