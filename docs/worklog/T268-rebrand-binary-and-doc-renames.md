# T268 - Rebrand binary and doc renames

## 1. Task summary

Rename packaged Electron CLI wrapper, CLI doc, and tool icon paths from legacy
`craft*` names to canonical `rox*` names while preserving launcher behavior.

## 2. Repo context discovered

- Phase R.3 requires `apps/electron/resources/bin/craft-agent` and
  `craft-agent.cmd` to become `rox-agent` and `rox-agent.cmd`.
- The shell and cmd wrappers dispatch through existing `CRAFT_*` env vars;
  env-var renames are explicitly owned by Phase R.6, so T268 only renames the
  wrapper files and product-facing command references.
- `apps/electron/resources/docs/craft-cli.md` is the bundled CLI command
  reference and contains `craft-agent` command examples throughout the body.
- `apps/electron/src/main/index.ts`, `packages/shared/src/docs/index.ts`, and
  `packages/shared/src/prompts/system.ts` reference the CLI doc path.
- `apps/electron/resources/tool-icons/tool-icons.json` maps the bundled ROX
  CLI entry to `craft-agent.png` and the `craft-agent` command.
- The app resource docs link to `craft-cli.md` from labels, sources, skills,
  permissions, and automations docs.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `apps/electron/resources/bin/craft-agent`
- `apps/electron/resources/bin/craft-agent.cmd`
- `apps/electron/resources/docs/craft-cli.md`
- `apps/electron/resources/docs/automations.md`
- `apps/electron/resources/docs/labels.md`
- `apps/electron/resources/docs/permissions.md`
- `apps/electron/resources/docs/skills.md`
- `apps/electron/resources/docs/sources.md`
- `apps/electron/resources/tool-icons/tool-icons.json`
- `apps/electron/src/main/index.ts`
- `packages/shared/src/docs/index.ts`
- `packages/shared/src/prompts/system.ts`

## 4. Tests added first

Extended `scripts/__tests__/rebrand-asset-paths.test.ts` before committing the
implementation. The T268 test asserts:

- legacy `apps/electron/resources/tool-icons/craft-agent.png` is absent and
  `apps/electron/resources/tool-icons/rox-agent.png` exists;
- legacy `apps/electron/resources/docs/craft-cli.md` is absent and
  `apps/electron/resources/docs/rox-cli.md` exists;
- legacy `apps/electron/resources/bin/craft-agent` and `.cmd` are absent and
  `rox-agent` / `rox-agent.cmd` exist;
- active CLI docs, `DOC_REFS`, the system prompt, doc links, and tool-icon
  mapping reference `rox-agent`, `rox-cli.md`, and `DOC_REFS.roxCli`.

## 5. Expected failing test output

Red run from the T267 baseline:

- Baseline: detached temp worktree at `82a8425`.
- Command: `bun test scripts/__tests__/rebrand-asset-paths.test.ts`.
- Result: exit 1.
- Expected failure: the logo asset test passed, and the new T268 test failed
  with `legacy CLI asset paths should be renamed`.
- Received legacy paths:
  - `apps/electron/resources/tool-icons/craft-agent.png`
  - `apps/electron/resources/docs/craft-cli.md`
  - `apps/electron/resources/bin/craft-agent`
  - `apps/electron/resources/bin/craft-agent.cmd`

## 6. Implementation changes

- Renamed:
  - `apps/electron/resources/tool-icons/craft-agent.png` ->
    `apps/electron/resources/tool-icons/rox-agent.png`
  - `apps/electron/resources/docs/craft-cli.md` ->
    `apps/electron/resources/docs/rox-cli.md`
  - `apps/electron/resources/bin/craft-agent` ->
    `apps/electron/resources/bin/rox-agent`
  - `apps/electron/resources/bin/craft-agent.cmd` ->
    `apps/electron/resources/bin/rox-agent.cmd`
- Rewrote the bundled CLI guide body to use `rox-agent`.
- Updated the app resource docs that link to the bundled CLI guide:
  `automations.md`, `labels.md`, `permissions.md`, `skills.md`, and
  `sources.md`.
- Updated `apps/electron/resources/tool-icons/tool-icons.json` to map the ROX
  CLI entry to `rox-agent`, `rox-agent.png`, and the `rox-agent` command.
- Updated packaged and debug `CRAFT_COMMANDS_DOC_PATH` values in
  `apps/electron/src/main/index.ts` to point at `rox-cli.md`.
- Renamed the shared doc ref from `DOC_REFS.craftCli` to `DOC_REFS.roxCli`
  and updated the system prompt table and CLI guidance.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-asset-paths.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun run build`
- `git diff --check`
- `git ls-files | rg 'apps/electron/resources/(tool-icons/craft-agent\\.png|docs/craft-cli\\.md|bin/craft-agent(\\.cmd)?$)'`
- `rg -n "craft-cli\\.md|craft-agent\\.png|apps/electron/resources/bin/craft-agent|DOC_REFS\\.craftCli|craftCli:" apps/electron/resources apps/electron/src/main packages/shared/src scripts/__tests__/rebrand-asset-paths.test.ts`
- `bun run validate:rebrand`

## 8. Passing test output summary

- `bun test scripts/__tests__/rebrand-asset-paths.test.ts`: 2 pass, 0 fail,
  31 assertions.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0.
- `git diff --check`: exit 0.
- `git ls-files` old binary/doc/icon grep: exit 1 with no matches.
- Targeted old-reference `rg`: exit 1 with no matches.
- `bun run validate:rebrand`: expected exit 1 with 3982 forbidden token
  findings still owned by later rebrand phases.

## 9. Build output summary

`bun run build`: exit 0. Electron main, preload, renderer, resources, and
assets build steps completed; Vite reported the existing large chunk warnings.

## 10. Remaining risks

- Phase R.6 owns `CRAFT_*` env-var migration, so T268 intentionally leaves
  wrapper internals using current env-var names.
- Later phases still own package-scope imports and broader command-string
  compatibility in non-resource code.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Red test proves binary/doc/icon gap | Pass | Red exit 1 from T267 baseline with only the new T268 test failing |
| Old binary/doc/icon filenames removed | Pass | `git ls-files` grep returned no matches |
| New `rox*` binary/doc/icon filenames exist | Pass | R.3 asset-path regression test passes |
| Active CLI docs reference `rox-agent` | Pass | CLI docs, doc links, `DOC_REFS.roxCli`, and system prompt assertions pass |
| Validation evidence recorded | Pass | Commands and outputs summarized above |
| Worklog complete | Pass | This 11-section worklog is complete |
| Commit created | Pass | This worklog is included in the T268 task commit in git history |
