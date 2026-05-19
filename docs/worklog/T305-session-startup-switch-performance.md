# T305 - Session startup and switch performance

## 1. Task summary

Fix session startup/switch lag caused by `AppShell` reloading skills when the active session working directory changes. The main measured hotspot is `loadAllSkills()` reparsing the full global skill catalog for each distinct project root.

## 2. Repo context discovered

- `apps/electron/src/renderer/components/app-shell/AppShell.tsx` derives `activeSessionWorkingDirectory` from selected session metadata and calls `window.electronAPI.getSkills(activeWorkspaceId, activeSessionWorkingDirectory)` whenever it changes.
- `packages/server-core/src/handlers/rpc/skills.ts` handles `SKILLS_GET` by calling `loadAllSkills(workspace.rootPath, effectiveWorkingDir)`.
- `packages/shared/src/skills/storage.ts` caches full merged results by `(workspaceRoot, projectRoot)`. This makes same-project reloads fast but forces global/workspace rescans when switching to another project root.
- `packages/shared/src/sessions/storage.ts` also does eager `listPlanFiles()` per session, but a synthetic 1000-session baseline was ~125ms; skills loading was the multi-second blocker.
- Current working tree has unrelated dirty `.agents/**`, `.omc/**`, and previous T304 docs. This task must not touch or stage those files.

## 3. Files inspected

- `packages/shared/src/skills/storage.ts`
- `packages/shared/src/skills/__tests__/storage.test.ts`
- `packages/server-core/src/handlers/rpc/skills.ts`
- `apps/electron/src/renderer/components/app-shell/AppShell.tsx`
- `packages/shared/src/sessions/storage.ts`
- `packages/shared/src/sessions/types.ts`
- `package.json`

## 4. Tests added first

- Added `loadAllSkills > should reuse lower-priority skill parses when switching project roots` in `packages/shared/src/skills/__tests__/storage.test.ts`. It creates one workspace-tier skill, loads two different project roots, and asserts the workspace/global skill objects are reused rather than reparsed.
- Added `loadAllSkills > should clear tier caches when skills cache is invalidated` to prove `invalidateSkillsCache()` is still the explicit refresh boundary.

## 5. Expected failing test output

First targeted run before implementation:

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

The failure confirms the existing `(workspaceRoot, projectRoot)` merged cache reparses lower-priority tiers when only the project root changes.

## 6. Implementation changes

- Refactored `packages/shared/src/skills/storage.ts` from a single merged `(workspaceRoot, projectRoot)` cache to tiered caches:
  - `globalSkillsCache` keyed by the global skill directory;
  - `workspaceSkillsCache` keyed by workspace root;
  - `projectSkillsCache` keyed by `{projectRoot}/.agents/skills`;
  - `mergedSkillsCache` still keyed by `(workspaceRoot, projectRoot)` for same-selection fast path.
- `loadAllSkills()` now merges cached tiers while preserving priority `global < workspace < project`.
- `invalidateSkillsCache()` clears all tier caches and merged results.
- Updated cache comments so working-directory changes are no longer documented as a reason to flush all skills; skill install/remove/update events remain the refresh boundary.

## 7. Validation commands run

```bash
bun test packages/shared/src/skills/__tests__/storage.test.ts
bun run typecheck:shared
bun /tmp/rox-perf-after.ts
```

## 8. Passing test output summary

- `bun test packages/shared/src/skills/__tests__/storage.test.ts`: `35 pass`, `0 fail`, `799 expect()` calls.
- `bun run typecheck:shared`: passed (`tsc --noEmit`, no diagnostics).
- Synthetic post-fix benchmark:

```json
{"kind":"skillsLoad:firstProject","count":10148,"ms":4083}
{"kind":"skillsLoad:secondProject","count":10148,"ms":2}
{"kind":"skillsLoad:sameSecondProjectCached","count":10148,"ms":0}
{"kind":"skillsLoad:globalObjectReused","slug":"banana-claude","sameRef":true}
```

Baseline from before this task was `secondProject` ~931ms and first project ~4257ms; the second project-root load now avoids reparsing the ~10k global catalog.

## 9. Build output summary

No Electron renderer/main source changed. Build was not run; shared typecheck and targeted shared tests cover the modified package surface.

## 10. Remaining risks

- First skill load still parses the full installed global catalog (~4s on this workstation). This task removes the repeated cost during session switches; a separate startup/background-loading ticket should address first-load UX if needed.
- Renderer still receives/stores ~10k skills and downstream mention/icon rendering may contribute jank. If UI remains heavy after backend cache fix, follow up by virtualizing/bounding skill mention data in `rich-text-input.tsx` / skill atoms.
- `listSessions()` still eagerly checks plan directories; measured lower priority (~125ms for 1000 sessions) but can be lazied later because `planCount` has no current renderer reads.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
| --- | --- | --- |
| Switching project roots reuses cached global/workspace skill tiers | PASS | Regression test asserts workspace/global object reuse across project roots; benchmark `secondProject` 2ms and `sameRef: true`. |
| Skill precedence remains global < workspace < project | PASS | Existing `loadAllSkills` precedence/dedup tests still pass. |
| `invalidateSkillsCache()` clears all relevant skill caches | PASS | Added invalidation regression test; targeted suite passes. |
| Targeted skill storage tests pass | PASS | `35 pass`, `0 fail`. |
| Shared typecheck passes | PASS | `bun run typecheck:shared` exit 0. |
| Benchmark shows cross-project skill load no longer reparses ~10k global skills | PASS | First project 4083ms; second project 2ms; same project 0ms. |
