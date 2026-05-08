# T101 - Electron Start Script Alias Contract Worklog

## 1. Task summary

Normalize Electron start script aliases so package manifests delegate through
the root `electron:dev` command instead of hardcoding `scripts/electron-dev.ts`
in multiple places.

Inherited dirty-tree note: root and nested package manifests already contained
partial start-script changes before this ticket. `scripts/electron-smoke-packaged-mac.ts`,
`events.jsonl`, `.claude/`, and `.ouroboros/` remain unrelated and unstaged.

## 2. Red evidence

Focused package-script contract added first:

```bash
bun test scripts/__tests__/electron-start-scripts.test.ts
```

Expected red result:

```text
0 pass
1 fail
Expected: "bun run electron:dev"
Received: "bun run scripts/electron-dev.ts"
```

The failure showed root `electron:start` was still duplicating the raw launcher
path instead of delegating to the canonical alias.

## 3. Test added first

Added `scripts/__tests__/electron-start-scripts.test.ts`.

The test asserts:

- root `electron:dev` is the only script that points directly at
  `scripts/electron-dev.ts`;
- root `electron:start` delegates to `bun run electron:dev`;
- nested Electron `start` and `start:win` delegate to
  `cd ../.. && bun run electron:dev`.

## 4. Implementation changes

- Changed root `package.json` `electron:start` to `bun run electron:dev`.
- Changed `apps/electron/package.json` `start` and `start:win` to
  `cd ../.. && bun run electron:dev`.
- Left `scripts/electron-dev.ts` unchanged.
- Left packaged-smoke marker policy, `events.jsonl`, `.claude/`, and
  `.ouroboros/` unstaged.

## 5. Validation commands

| Command | Result | Evidence |
|---|---|---|
| `bun test scripts/__tests__/electron-start-scripts.test.ts` | RED, expected | 0 pass, 1 fail on duplicated raw launcher path |
| `bun test scripts/__tests__/electron-start-scripts.test.ts` | PASS | 1 pass, 0 fail, 4 expects |
| `bun run validate:docs` | PASS | `11 skills`, `102 tickets`, `7 required docs` |
| `git diff --check` | PASS | no whitespace errors |

## 6. Remaining risks

- This is a script-contract slice only; it does not launch the interactive dev
  app because `electron:dev` is intentionally long-running.
- Packaged smoke marker policy remains a separate dirty-tree candidate and was
  not staged here.
- Runtime artifacts remain unstaged.
