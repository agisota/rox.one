# T100 - ROX.ONE Backend Active Copy Worklog

## 1. Task summary

Normalize active backend/provider labels from `ROX ONE Backend` to
`ROX.ONE Backend` in runtime and renderer code. This intentionally excludes
historical docs, localization JSON, and compatibility fixtures unless a later
ticket expands the localization scope.

Inherited dirty-tree note: some T100-shaped changes were already present in
`AiSettingsPage`, `models-pi`, and renderer `index.html`; package start-script
changes, packaged smoke marker policy, `events.jsonl`, `.claude/`, and
`.ouroboros/` are unrelated and remain unstaged.

## 2. Red evidence

Focused copy regression added first:

```bash
bun test scripts/__tests__/rox-brand-copy.test.ts
```

Expected red result:

```text
1 pass
2 fail
offenders:
- apps/electron/src/renderer/lib/provider-icons.ts
- apps/electron/src/renderer/components/apisetup/ApiKeyInput.tsx
- apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx
- packages/shared/src/agent/pi-agent.ts
- packages/shared/src/agent/diagnostics.ts
```

## 3. Test added first

Added `scripts/__tests__/rox-brand-copy.test.ts`.

The test:

- scans active runtime/renderer files for old `ROX ONE Backend` labels;
- asserts the renderer document title is `<title>ROX.ONE</title>`;
- asserts active backend surfaces still visibly include `ROX.ONE Backend`.

## 4. Implementation changes

- Updated active provider/backend labels to `ROX.ONE Backend` in:
  - `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx`
  - `apps/electron/src/renderer/lib/provider-icons.ts`
  - `apps/electron/src/renderer/components/apisetup/ApiKeyInput.tsx`
  - `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`
  - `packages/shared/src/config/models-pi.ts`
  - `packages/shared/src/agent/pi-agent.ts`
  - `packages/shared/src/agent/diagnostics.ts`
- Updated renderer HTML title to `ROX.ONE`.
- Left package start-script changes, packaged smoke policy, localized JSON,
  docs, tests/fixtures, `events.jsonl`, `.claude/`, and `.ouroboros/` outside
  this commit.

## 5. Validation commands

| Command | Result | Evidence |
|---|---|---|
| `bun test scripts/__tests__/rox-brand-copy.test.ts` | RED, expected | 1 pass, 2 fail on five active old-label files |
| `bun test scripts/__tests__/rox-brand-copy.test.ts` | PASS | 3 pass, 0 fail, 9 expects |
| `bun run typecheck:electron` | PASS | `tsc --noEmit` exited 0 |
| `bun run lint:electron` | PASS | `eslint src/` exited 0 |
| `bun run validate:docs` | PASS | `11 skills`, `101 tickets`, `7 required docs` |
| `git diff --check` | PASS | no whitespace errors |

## 6. Remaining risks

- Localized onboarding strings still contain `ROX ONE Backend`; this was
  intentionally left for a product/localization pass instead of mixing broad
  translation churn into T100.
- Historical docs/test fixtures can still mention `ROX ONE` by design.
- Package start-script changes and packaged smoke marker policy remain separate
  dirty-tree candidates and were not staged here.
