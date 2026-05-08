# T099 - Electron Smoke Shutdown Stabilization Worklog

## 1. Task summary

Restore and harden deterministic `bun run electron:smoke` shutdown. T098
observed a smoke run that reached readiness markers and logged the
exit-on-ready request, but timed out waiting for process exit. Fresh T099
runtime verification did not reproduce that timeout, so this ticket focused on
the source-level shutdown fallback that could still make the same class of
failure intermittent.

Inherited dirty-tree note: package script, renderer branding, packaged smoke,
`events.jsonl`, `.claude/`, and `.ouroboros/` changes were already present
before this ticket. I will stage only the files needed for T099.

## 2. Red evidence

Fresh runtime smoke check:

```bash
bun run electron:smoke
```

Result: PASS. Evidence included `ROX_SERVER_URL=`, `App initialized
successfully`, `[smoke] Exit-on-ready requested`, session cleanup, and
`[smoke] Electron headless startup passed`.

Focused source-level regression added before implementation:

```bash
bun test scripts/__tests__/electron-smoke.test.ts
```

Expected red result:

```text
2 pass
1 fail
expect(received).not.toContain(expected)
Expected to not contain: ".unref()"
```

## 3. Test added first

Added `electron smoke isolation > keeps the smoke force-exit fallback alive
during async quit cleanup`. The test asserts that smoke shutdown still calls
`app.quit()`, has a `setTimeout(() => app.exit(exitCode), 1_000)` fallback, and
does not unref that fallback timer.

## 4. Implementation changes

- Kept the inherited smoke-mode fallback that schedules `app.exit(exitCode)`
  after `app.quit()`.
- Removed `.unref()` from the force-exit timer so the fallback remains live if
  async `before-quit` cleanup stalls.
- Left unrelated dirty files unstaged: package script changes, renderer branding
  text, packaged-smoke marker changes, `events.jsonl`, `.claude/`, and
  `.ouroboros/`.

## 5. Validation commands

| Command | Result | Evidence |
|---|---|---|
| `bun test scripts/__tests__/electron-smoke.test.ts` | RED, expected | 2 pass, 1 fail on `.unref()` |
| `bun test scripts/__tests__/electron-smoke.test.ts` | PASS | 3 pass, 0 fail, 11 expects |
| `bun run electron:smoke` | PASS | startup markers, cleanup, and `[smoke] Electron headless startup passed` |
| `bun run typecheck:electron` | PASS | `tsc --noEmit` exited 0 |
| `bun run lint:electron` | PASS | `eslint src/` exited 0 |
| `bun run validate:docs` | PASS | `11 skills`, `100 tickets`, `7 required docs` |
| `git diff --check` | PASS | no whitespace errors |

## 6. Remaining risks

- Fresh runtime smoke passed twice in this ticket, but the T098 timeout was not
  reproduced directly during T099. The source hardening prevents the observed
  class of fallback loss, but does not prove no other host-level shutdown
  stalls can ever occur.
- Existing Vite large chunk warnings remain unchanged and are outside this
  smoke shutdown slice.
- Unrelated dirty runtime/branding/package artifacts remain in the working tree
  and were intentionally excluded from the T099 commit.
