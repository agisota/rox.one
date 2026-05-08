# T102 - Packaged Smoke Exit Proof Contract Worklog

## 1. Task summary

Clarify the packaged macOS smoke contract: packaged readiness proof is a clean
smoke-mode process exit, while stdout markers are optional diagnostics because
production Electron logging can route readiness details outside stdout/stderr.

Inherited dirty-tree note: `scripts/electron-smoke-packaged-mac.ts` already
contained the empty-marker direction before this ticket. This ticket adds a
source-level regression and removes stale marker state. Runtime artifacts remain
unstaged.

## 2. Red evidence

Focused packaged-smoke contract added first:

```bash
bun test scripts/__tests__/electron-packaged-smoke-contract.test.ts
```

Expected red result:

```text
0 pass
1 fail
Expected to not contain: "'ROX_SERVER_URL=': false"
```

The failure showed packaged smoke had moved to empty required markers but still
kept stale marker state.

## 3. Test added first

Added `scripts/__tests__/electron-packaged-smoke-contract.test.ts`.

The test asserts:

- packaged smoke has an explicit empty `REQUIRED_MARKERS` list;
- packaged readiness is documented as clean smoke-mode exit proof;
- stale `ROX_SERVER_URL=` marker state is absent;
- URL/token redaction remains;
- normal `scripts/electron-smoke.ts` still requires `ROX_SERVER_URL=` and
  `App initialized successfully`.

## 4. Implementation changes

- Kept packaged `REQUIRED_MARKERS` empty because stdout markers are optional
  diagnostics for production-packaged runs.
- Removed the stale `ROX_SERVER_URL=` entry from the packaged smoke `seen`
  map.
- Left normal `scripts/electron-smoke.ts` marker requirements unchanged.

## 5. Validation commands

| Command | Result | Evidence |
|---|---|---|
| `bun test scripts/__tests__/electron-packaged-smoke-contract.test.ts` | RED, expected | 0 pass, 1 fail on stale `ROX_SERVER_URL=` seen state |
| `bun test scripts/__tests__/electron-packaged-smoke-contract.test.ts` | PASS | 1 pass, 0 fail, 6 expects |
| `bun run electron:smoke:packaged:mac` | PASS | redacted URL/token and `[packaged-smoke] ROX.ONE packaged headless startup passed` |
| `bun run validate:docs` | PASS | `11 skills`, `103 tickets`, `7 required docs` |
| `git diff --check` | PASS | no whitespace errors |

## 6. Remaining risks

- The packaged app used for runtime proof was an existing local artifact; this
  ticket did not rebuild macOS release artifacts.
- Packaged smoke intentionally no longer requires stdout readiness markers; if
  future packaging reliably restores stdout markers, that can be tightened in a
  separate ticket.
- Runtime artifacts remain unstaged.
