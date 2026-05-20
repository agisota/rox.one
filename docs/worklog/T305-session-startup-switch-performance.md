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
