# T305 - Session startup and switch performance

## 1. Task summary

Fix session startup/switch lag around large skill catalogs. First layer removed repeated backend reparsing of the global skill catalog when the active session working directory changes. Continuation layer removes renderer jank from receiving ~10k skills by preventing closed composer skill-item allocation, capping visible mention items, and stopping eager preload of every skill icon.

## 2. Repo context discovered

- `apps/electron/src/renderer/components/app-shell/AppShell.tsx` derives `activeSessionWorkingDirectory` from selected session metadata and calls `window.electronAPI.getSkills(activeWorkspaceId, activeSessionWorkingDirectory)` whenever it changes.
- `packages/server-core/src/handlers/rpc/skills.ts` handles `SKILLS_GET` by calling `loadAllSkills(workspace.rootPath, effectiveWorkingDir)`.
- `packages/shared/src/skills/storage.ts` previously cached only full merged `(workspaceRoot, projectRoot)` results; switching project roots reparsed global/workspace tiers.
- `apps/electron/src/renderer/components/ui/rich-text-input.tsx` received the full `skills` array and eagerly called `loadSkillIcon(skill, workspaceId)` for every skill. With ~10k skills this could create renderer work and icon discovery/file IPC storms on session switches.
- `apps/electron/src/renderer/components/ui/mention-menu.tsx` built `skills.map(...)` into mention sections even while the mention menu was closed. This made ordinary composer rerenders/session switches allocate thousands of `MentionItem` objects that were not visible.
- `packages/shared/src/sessions/storage.ts` also does eager `listPlanFiles()` per session, but a synthetic 1000-session baseline was ~125ms; skills loading was the multi-second blocker.
- Current working tree has unrelated dirty `.agents/**` and `.omc/**` files. This task must not touch or stage those files.

## 3. Files inspected

- `packages/shared/src/skills/storage.ts`
- `packages/shared/src/skills/__tests__/storage.test.ts`
- `packages/server-core/src/handlers/rpc/skills.ts`
- `apps/electron/src/renderer/components/app-shell/AppShell.tsx`
- `apps/electron/src/renderer/components/ui/rich-text-input.tsx`
- `apps/electron/src/renderer/components/ui/mention-menu.tsx`
- `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`
- `apps/electron/src/renderer/components/ui/__tests__/rich-text-input.test.ts`
- `apps/electron/src/renderer/components/ui/__tests__/mention-menu.test.ts`
- `packages/shared/src/sessions/storage.ts`
- `packages/shared/src/sessions/types.ts`
- `package.json`

## 4. Tests added first

Backend cache layer:

- Added `loadAllSkills > should reuse lower-priority skill parses when switching project roots` in `packages/shared/src/skills/__tests__/storage.test.ts`. It creates one workspace-tier skill, loads two different project roots, and asserts the workspace/global skill objects are reused rather than reparsed.
- Added `loadAllSkills > should clear tier caches when skills cache is invalidated` to prove `invalidateSkillsCache()` is still the explicit refresh boundary.

Renderer jank layer:

- Added `buildMentionSections` tests in `apps/electron/src/renderer/components/ui/__tests__/mention-menu.test.ts` to require:
  - no skill/source sections while the mention menu is closed;
  - unfiltered skill sections capped to `MAX_MENTION_SKILL_ITEMS`;
  - filtering checks the full skill catalog before applying the visible cap.
- Added `createRichTextIconPreloadPlan` tests in `apps/electron/src/renderer/components/ui/__tests__/rich-text-input.test.ts` to require source icon preload while proving skill icon preload stays empty even with a large skill list.

## 5. Expected failing test output

Backend first targeted run before implementation:

```text
bun test packages/shared/src/skills/__tests__/storage.test.ts
...
(fail) loadAllSkills > should reuse lower-priority skill parses when switching project roots
error: expect(received).toBe(expected)
Expected: { slug: "_test_storage_cached_ws", ... }
Received: serializes to the same string

33 pass
1 fail
```

Renderer first targeted run before implementation:

```text
bun test apps/electron/src/renderer/components/ui/__tests__/rich-text-input.test.ts apps/electron/src/renderer/components/ui/__tests__/mention-menu.test.ts
...
TypeError: buildMentionSections is not a function
(fail) buildMentionSections > returns no skill/source sections while the mention menu is closed
(fail) buildMentionSections > caps the unfiltered skill section to the renderer-safe limit
(fail) buildMentionSections > filters the full skill catalog before applying the visible cap

23 pass
3 fail
```

The failure confirms the renderer did not yet expose or enforce a closed-menu/visible-cap shaping boundary for the large skill catalog.

## 6. Implementation changes

Backend cache layer:

- Refactored `packages/shared/src/skills/storage.ts` from a single merged `(workspaceRoot, projectRoot)` cache to tiered caches:
  - `globalSkillsCache` keyed by the global skill directory;
  - `workspaceSkillsCache` keyed by workspace root;
  - `projectSkillsCache` keyed by `{projectRoot}/.agents/skills`;
  - `mergedSkillsCache` still keyed by `(workspaceRoot, projectRoot)` for same-selection fast path.
- `loadAllSkills()` now merges cached tiers while preserving priority `global < workspace < project`.
- `invalidateSkillsCache()` clears all tier caches and merged results.
- Updated cache comments so working-directory changes are no longer documented as a reason to flush all skills; skill install/remove/update events remain the refresh boundary.

Renderer jank layer:

- Added `createRichTextIconPreloadPlan()` in `rich-text-input.tsx` and changed the icon preload effect to preload source icons only.
- Removed eager `loadSkillIcon()` fan-out from `RichTextInput`; visible `SkillAvatar` / `useEntityIcon` remains the lazy skill icon load path.
- Added `MAX_MENTION_SKILL_ITEMS = 50` and `buildMentionSections()` in `mention-menu.tsx`.
- `useInlineMention()` now returns no skill/source sections while the menu is closed and caps visible skill mention items while preserving full-catalog filtering for typed queries.
- `InlineMentionMenu` memoizes filtered/flat items and returns empty derived lists while closed.

## 7. Validation commands run

```bash
bun test packages/shared/src/skills/__tests__/storage.test.ts
bun run typecheck:shared
bun /tmp/rox-perf-after.ts
bun test apps/electron/src/renderer/components/ui/__tests__/rich-text-input.test.ts apps/electron/src/renderer/components/ui/__tests__/mention-menu.test.ts
bun run typecheck:electron
bun test /tmp/rox-mention-perf.test.ts
git diff --check -- apps/electron/src/renderer/components/ui/rich-text-input.tsx apps/electron/src/renderer/components/ui/mention-menu.tsx apps/electron/src/renderer/components/ui/__tests__/rich-text-input.test.ts apps/electron/src/renderer/components/ui/__tests__/mention-menu.test.ts
git fetch https://github.com/agisota/rox.one.git main
git diff --check origin/main..HEAD
bun install --frozen-lockfile
gh pr checks 303 --repo agisota/rox.one
bun run validate:mac-diag-smoke-workflow
bun run typecheck:electron
~/.bun/bin/bunx vitest run --config vitest.config.ts src/renderer/components/onboarding/__tests__/OnboardingPromptModal.rtl.test.tsx src/renderer/pages/settings/__tests__/BehaviorSettingsPage.design-autolaunch.rtl.test.tsx
bun test apps/electron/src/main/__tests__/rox-design-view-manager.partition.test.ts apps/electron/src/transport/__tests__/channel-map-parity.test.ts
bun test apps/electron/src/renderer/pages/settings/__tests__/BehaviorSettingsPage.design-autolaunch.rtl.test.tsx packages/shared/src/protocol/__tests__/routing.test.ts apps/electron/src/transport/__tests__/channel-map-parity.test.ts
git merge --no-ff --no-edit origin/main
bun run validate:mac-diag-smoke-workflow
bun run validate:mac-arm-build-workflow
bun run typecheck:electron
bun run typecheck:shared
bun run lint:i18n:sorted
bun test apps/electron/src/shared/__tests__/ipc-channels.test.ts apps/electron/src/main/handlers/__tests__/registration.test.ts apps/electron/src/main/__tests__/quit-orchestrator.test.ts
bun test apps/electron/src/renderer/components/ui/__tests__/rich-text-input.test.ts apps/electron/src/renderer/components/ui/__tests__/mention-menu.test.ts
bun test packages/shared/src/protocol/__tests__/routing.test.ts apps/electron/src/transport/__tests__/channel-map-parity.test.ts apps/electron/src/main/__tests__/rox-design-view-manager.partition.test.ts
cd apps/electron && ~/.bun/bin/bunx vitest run --config vitest.config.ts src/renderer/components/onboarding/__tests__/OnboardingPromptModal.rtl.test.tsx src/renderer/pages/settings/__tests__/BehaviorSettingsPage.design-autolaunch.rtl.test.tsx
bun test scripts/__tests__/validate-rox-design-xvfb-workflow.test.ts packages/server-core/src/sessions/__tests__/skill-catalog-defer.test.ts scripts/__tests__/build-nightly-release-notes.test.ts packages/agent-contract/src/__tests__/agent-answer-package.test.ts infra/__tests__/rox-one-release-feed-worker.test.ts
bun run rox-design:prepare:check
bun run rox-design:payload:verify
git diff --check
git diff --cached --check
```

## 8. Passing test output summary

- `bun test packages/shared/src/skills/__tests__/storage.test.ts`: `35 pass`, `0 fail`, `799 expect()` calls.
- `bun run typecheck:shared`: passed (`tsc --noEmit`, no diagnostics).
- `bun test apps/electron/src/renderer/components/ui/__tests__/rich-text-input.test.ts apps/electron/src/renderer/components/ui/__tests__/mention-menu.test.ts`: `28 pass`, `0 fail`, `57 expect()` calls.
- `bun run typecheck:electron`: passed on the original task branch before rebasing the renderer-only PR branch.
- `bun run typecheck:electron` on the current `agisota/rox.one` PR branch fails on existing main-branch diagnostics outside the T305 files:
  - `src/main/__tests__/rox-design-view-manager.partition.test.ts` `WindowManager` test-stub shape;
  - `src/renderer/components/onboarding/__tests__/OnboardingPromptModal.rtl.test.tsx` `Mock<[AutoLaunchDesignChoice]>` typing;
  - `src/shared/menu-schema.ts` missing `behavior` title key;
  - `src/transport/__tests__/channel-map-parity.test.ts` auto-launch channel parity.
- `git diff --check` for renderer files: passed, no whitespace errors.
- `git diff --check origin/main..HEAD`: passed, no whitespace errors.
- `bun install --frozen-lockfile`: initially failed in PR CI because `bun.lock` was stale after main upgraded `@rox-one/server` `ws` from `8.20.0` to `8.20.1`; rerunning `bun install --lockfile-only` updated only `bun.lock`, and the frozen install now passes locally.
- `bun run validate:mac-diag-smoke-workflow`: initially failed because the validator still expected `node /tmp/diag-launch.mjs` while the workflow now stages the helper at `/tmp/pw/diag-launch.mjs`; the validator was aligned and now passes locally.
- `bun run typecheck:electron`: now passes on the PR branch after fixing current-main TypeScript drift outside the T305 renderer files:
  - narrowed Rox Design view-manager test stubs through the real `WindowManager` type boundary;
  - updated Vitest mock generic syntax in `OnboardingPromptModal.rtl.test.tsx`;
  - added the missing `behavior` settings icon;
  - moved auto-launch preference channels into shared `RPC_CHANNELS`, `CHANNEL_MAP`, and `LOCAL_ONLY_CHANNELS`.
- `~/.bun/bin/bunx vitest run --config vitest.config.ts src/renderer/components/onboarding/__tests__/OnboardingPromptModal.rtl.test.tsx src/renderer/pages/settings/__tests__/BehaviorSettingsPage.design-autolaunch.rtl.test.tsx`: `2 passed`, `18 passed`.
- `bun test apps/electron/src/main/__tests__/rox-design-view-manager.partition.test.ts apps/electron/src/transport/__tests__/channel-map-parity.test.ts`: `4 pass`, `0 fail`, `1176 expect()` calls.
- `bun test apps/electron/src/renderer/pages/settings/__tests__/BehaviorSettingsPage.design-autolaunch.rtl.test.tsx packages/shared/src/protocol/__tests__/routing.test.ts apps/electron/src/transport/__tests__/channel-map-parity.test.ts`: RTL path is intentionally excluded from `bun:test` by `bunfig.toml`; protocol/channel tests still ran and passed (`10 pass`, `0 fail`, `1505 expect()` calls).
- After merging current `origin/main` (`02544e15`) into the PR branch, the merge conflict in `scripts/validate-mac-diag-smoke-workflow.ts` was resolved by keeping both the upstream arm64/x64 matrix/Rosetta checks and the existing `/tmp/pw/diag-launch.mjs` validator expectation.
- `bun run typecheck:electron`: passed after adapting `QuitOrchestrator` to ignore the `RoxDesignRuntimeManager.stop()` status return and keeping the handler callback typed as `Promise<void>`.
- `bun run typecheck:shared`: passed.
- `bun run lint:i18n:sorted`: passed.
- `bun test apps/electron/src/shared/__tests__/ipc-channels.test.ts apps/electron/src/main/handlers/__tests__/registration.test.ts apps/electron/src/main/__tests__/quit-orchestrator.test.ts`: `24 pass`, `0 fail`, `46 expect()` calls after adding the two auto-launch preference channels to the IPC snapshot and registration coverage.
- `bun test apps/electron/src/renderer/components/ui/__tests__/rich-text-input.test.ts apps/electron/src/renderer/components/ui/__tests__/mention-menu.test.ts`: `28 pass`, `0 fail`, `57 expect()` calls.
- `bun test packages/shared/src/protocol/__tests__/routing.test.ts apps/electron/src/transport/__tests__/channel-map-parity.test.ts apps/electron/src/main/__tests__/rox-design-view-manager.partition.test.ts`: `12 pass`, `0 fail`, `1511 expect()` calls.
- `cd apps/electron && ~/.bun/bin/bunx vitest run --config vitest.config.ts src/renderer/components/onboarding/__tests__/OnboardingPromptModal.rtl.test.tsx src/renderer/pages/settings/__tests__/BehaviorSettingsPage.design-autolaunch.rtl.test.tsx`: `2 passed`, `18 passed`.
- `bun test scripts/__tests__/validate-rox-design-xvfb-workflow.test.ts packages/server-core/src/sessions/__tests__/skill-catalog-defer.test.ts scripts/__tests__/build-nightly-release-notes.test.ts packages/agent-contract/src/__tests__/agent-answer-package.test.ts infra/__tests__/rox-one-release-feed-worker.test.ts`: `75 pass`, `0 fail`, `180 expect()` calls.
- `bun run validate:mac-arm-build-workflow` and `bun run validate:mac-diag-smoke-workflow`: both pass.
- `bun run rox-design:prepare:check` and `bun run rox-design:payload:verify`: both pass locally against `/Applications/Open Design.app/Contents/Resources`; payload verification reports Open Design `0.7.0`.
- `bun install --frozen-lockfile`: passed after the current-main merge.
- `git diff --check` and `git diff --cached --check`: pass after removing trailing whitespace introduced by upstream `docs/release/os-lab-coverage.md`.

## 9. Build output summary

Full Electron build was not run. Source/runtime behavior changed in renderer helpers, so targeted renderer unit tests were run. Backend package surface was covered by targeted shared tests and `bun run typecheck:shared` in the original task branch; the backend cache commit is already present on current `origin/main` as `1c9749e3`, so PR #303 carries only the renderer hot-path delta plus the lockfile sync needed for frozen CI installs.

Current PR #303 CI state before the lockfile/validator sync commits:

- `validate`, `bundle-budget`, `ROX ONE core scenario suite`, and macOS/Windows/Linux packaged launch jobs all failed before test execution at `bun install --frozen-lockfile`.
- Failure text: `lockfile had changes, but lockfile is frozen`.
- `Gitleaks secret scan` passed.
- Linux installer launcher guard jobs passed.

Current PR #303 CI state after `72d38b64` and `0be954ea`:

- `bundle-budget`, `ROX ONE core scenario suite`, Gitleaks, Linux Ubuntu packaged launch, Windows packaged launch, and Linux installer launcher guards pass.
- `validate` was rerun on the validator sync head and was still in progress at the last poll.
- macOS Sequoia ARM64 packaged launch still fails outside T305 at `rox-design:payload:verify` because `apps/electron/resources/rox-design/MANIFEST.json` is absent in CI.
- CircleCI validate still fails and needs CircleCI log follow-up.

Current branch also contains a small baseline-checks repair so the performance PR can be reviewed against current `main` without unrelated TypeScript gate failures:

- `scripts/validate-mac-diag-smoke-workflow.ts`: validator now expects `node /tmp/pw/diag-launch.mjs`, matching `.github/workflows/mac-diag-smoke.yml`.
- `apps/electron/src/main/__tests__/rox-design-view-manager.partition.test.ts`: test doubles are explicitly cast at the `WindowManager` boundary.
- `apps/electron/src/renderer/components/onboarding/__tests__/OnboardingPromptModal.rtl.test.tsx`: Vitest mock generic syntax now matches the installed Vitest type surface.
- `apps/electron/src/shared/menu-schema.ts`: `behavior` settings subpage has an icon entry.
- `packages/shared/src/protocol/channels.ts`, `packages/shared/src/protocol/routing.ts`, `apps/electron/src/transport/channel-map.ts`, and `apps/electron/src/main/handlers/preferences-ipc.ts`: auto-launch preference channels use the shared channel registry and are classified local-only.

Synthetic backend post-fix benchmark:

```json
{"kind":"skillsLoad:firstProject","count":10148,"ms":4083}
{"kind":"skillsLoad:secondProject","count":10148,"ms":2}
{"kind":"skillsLoad:sameSecondProjectCached","count":10148,"ms":0}
{"kind":"skillsLoad:globalObjectReused","slug":"banana-claude","sameRef":true}
```

Synthetic renderer post-fix shaping probe over 10,148 skills:

```json
{"kind":"mentionSections:closed","sections":0,"items":0,"ms":0}
{"kind":"mentionSections:openUnfiltered","sections":1,"items":50,"limit":50,"ms":0}
{"kind":"mentionSections:openFiltered","sections":1,"items":1,"hasNeedle":true,"ms":15}
```

Baseline from before this task was backend `secondProject` ~931ms and first project ~4257ms; the second project-root load now avoids reparsing the ~10k global catalog. Renderer closed-menu section shaping now performs no skill item allocation.

## 10. Remaining risks

- First skill load still parses the full installed global catalog (~4s on this workstation). This task removes the repeated cost during session switches; a separate startup/background-loading ticket should address first-load UX if needed.
- `AppShell` still stores and publishes the full `skills` array into renderer state/atoms. Downstream consumers are now bounded in the composer hot path, but a future ticket could move to paged skill search if global catalogs keep growing.
- Filtering skills in the mention menu still scans the full catalog when the user types a query. The visible result is capped and the measured 10k-skill query was ~15ms, but fuzzy indexing could improve this later.
- `listSessions()` still eagerly checks plan directories; measured lower priority (~125ms for 1000 sessions) but can be lazied later because `planCount` has no current renderer reads.
- macOS packaged-launch CI has a repo-wide Rox Design payload supply-chain dependency. The PR now preserves `NOTICES.md`, validates the mac ARM workflow contract, and bootstraps the local payload before verification when `MANIFEST.json` is missing; CI still depends on a valid payload source/archive being available to the runner.
- PR #303 now contains an `origin/main` merge commit because GitHub reported the branch as conflicting after current main advanced. The merge brings unrelated upstream release/CI files into the branch; review should treat those as upstream merge content, not the T305 performance delta.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
| --- | --- | --- |
| Switching project roots reuses cached global/workspace skill tiers | PASS | Regression test asserts workspace/global object reuse across project roots; benchmark `secondProject` 2ms and `sameRef: true`. |
| Skill precedence remains global < workspace < project | PASS | Existing `loadAllSkills` precedence/dedup tests still pass. |
| `invalidateSkillsCache()` clears all relevant skill caches | PASS | Added invalidation regression test; targeted suite passes. |
| Targeted skill storage tests pass | PASS | `35 pass`, `0 fail`. |
| Shared typecheck passes | PASS | `bun run typecheck:shared` exit 0. |
| Rich text input does not eagerly preload all skill icons | PASS | `createRichTextIconPreloadPlan` tests expect `skillIcons: []` with 100 skills; targeted renderer tests pass. |
| Mention menu does not allocate skill/source sections while closed | PASS | `buildMentionSections({ isOpen: false, ... })` test returns `[]`; perf probe shows `items: 0`, `ms: 0`. |
| Mention menu caps unfiltered visible skills | PASS | `MAX_MENTION_SKILL_ITEMS` test and perf probe show `items: 50`. |
| Mention menu still searches the full catalog for typed skill filters | PASS | Filter regression finds `skill-999` / `Needle Workflow` beyond the initial cap; perf probe found `skill-10147`. |
| Electron renderer typecheck passes | BLOCKED-BY-BASELINE | Passed on the original task branch; current PR branch fails on unrelated current-main diagnostics outside T305 listed above. |
| Renderer whitespace diff check passes | PASS | `git diff --check -- ...` and `git diff --check origin/main..HEAD` exit 0. |
| PR branch frozen install passes | PASS | Local `bun install --frozen-lockfile` passes after committing the one-line lockfile sync. |
| PR branch mac diag workflow validator passes | PASS | Local `bun run validate:mac-diag-smoke-workflow` passes after aligning the expected helper path with the workflow. |
| Current PR branch Electron typecheck passes | PASS | `bun run typecheck:electron` exit 0 after the small baseline-checks repair. |
| Baseline RTL tests touched by typecheck repair pass | PASS | Vitest onboarding/settings command: `2 passed`, `18 passed`. |
| Protocol/channel parity tests pass | PASS | `routing.test.ts` + `channel-map-parity.test.ts`: `10 pass`, `0 fail`. |
| PR branch merges current `origin/main` without unresolved conflicts | PASS | Merge conflict in `scripts/validate-mac-diag-smoke-workflow.ts` resolved; `git status` reports all conflicts fixed and staged for merge commit. |
| Current-main IPC registration and channel snapshot gates pass | PASS | `ipc-channels.test.ts` + handler registration + quit orchestrator: `24 pass`, `0 fail`. |
| Mac workflow validators pass after current-main merge | PASS | `validate:mac-arm-build-workflow` and `validate:mac-diag-smoke-workflow` pass. |
| Local Rox Design payload verification passes | PASS | `rox-design:prepare:check` + `rox-design:payload:verify` pass locally for Open Design `0.7.0`. |
