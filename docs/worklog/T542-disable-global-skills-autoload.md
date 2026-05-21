# T542 - Disable global skills autoload for active sessions

## 1. Task Summary

Remove global skills from the default active session catalog while preserving
explicit skill invocation by slug.

## 2. Repo Context Discovered

- `SKILLS_GET` returned `loadAllSkills(workspace.rootPath, workingDirectory)`,
  so the renderer's `getSkills(...)` path scanned global, workspace, and
  project skills.
- Session skill-change broadcasts, automation mention resolution, marketplace
  installed-state checks, and config-watcher list refreshes also used the full
  catalog.
- `BaseAgent.extractSkillPaths()` loaded the full catalog just to validate
  explicit `[skill:...]` mentions.
- `resolveToolDisplayMeta()` loaded the full catalog just to decorate a single
  `Skill` tool invocation.

## 3. Implementation Changes

- Added `loadActiveSkills()` for workspace/project active catalogs.
- Switched UI/session catalog call sites from `loadAllSkills()` to
  `loadActiveSkills()`.
- Added `extractSkillMentionSlugs()` so agents can parse explicit skill
  mentions without first loading every available skill.
- Switched agent skill resolution and Skill tool metadata lookup to targeted
  `loadSkillBySlug()` reads.
- Kept `loadAllSkills()` exported for intentional full-inventory workflows.
- Isolated packaged UI smoke from the operator's real `userData` and keychain
  by wiring `ROX_SMOKE_USER_DATA_DIR` plus fake account API responses.
- Avoided unnecessary `safeStorage` access when there is no persisted account
  session file.

## 4. Tests Added

- Active catalog excludes global skills, includes workspace/project skills, and
  preserves project-over-workspace priority.
- Skill mention slug extraction handles duplicates and workspace-qualified
  mentions without a loaded catalog.
- Base agent chat still prepends the explicit `SKILL.md` read directive for a
  mentioned skill.

## 5. Validation Commands Run

- `bun test packages/shared/src/skills/__tests__/storage.test.ts packages/shared/src/mentions/__tests__/resolve-skill-source-mentions.test.ts packages/shared/src/agent/__tests__/base-agent.test.ts packages/server-core/src/sessions/__tests__/skill-catalog-defer.test.ts apps/electron/src/main/__tests__/account-session-store.test.ts scripts/__tests__/electron-smoke.test.ts`
  - Result: 110 pass, 0 fail.
- `bun run typecheck:all`
  - Result: pass.
- `bun run electron:dist:dev:mac:arm64`
  - Result: pass; produced mac arm64 DMG/ZIP.
- `ROX_RC_MODE=unsigned ROX_ARTIFACT_PLATFORM=mac ROX_ARTIFACT_ARCH=arm64 bun run validate:packaged-artifacts`
  - Result: pass; Rox Design payload externalized under `app.asar.unpacked`.
- `codesign --verify --deep --strict --verbose=2 apps/electron/release/mac-arm64/ROX.ONE.app`
  - Result: pass.
- Installed `/Applications/ROX.ONE.app` from the rebuilt app bundle and verified
  `CFBundleShortVersionString=1.0.3`, `CFBundleVersion=102`.
- `codesign --verify --deep --strict --verbose=2 /Applications/ROX.ONE.app`
  - Result: pass.
- `ROX_MAC_APP_PATH=/Applications/ROX.ONE.app bun run electron:smoke:packaged:mac`
  - Result: pass.
- `ROX_MAC_APP_PATH=/Applications/ROX.ONE.app ROX_UI_SMOKE_EVIDENCE_DIR=/tmp/rox-one-hotfix-ui-smoke-final bun run electron:ui-smoke:packaged:mac`
  - Result: pass; account, experience, and composer smoke screens verified.
- Live Rox Design CDP probe against `/Applications/ROX.ONE.app`
  - Result: pass; `window.electronAPI.roxDesign.start()` returned
    `status=running`, `version=0.7.0`, daemon/web URLs, then stopped cleanly.
  - Verified user data directory was used and bundled
    `.rox-design-data` was not created.

## 6. Remaining Risks

- Public signed/notarized artifacts still require a proper release build path.
- Existing release notes from older versions still describe the previous
  global/project/workspace full-list behavior; the runtime behavior now favors
  lightweight active catalogs.
