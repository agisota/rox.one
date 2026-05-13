# T352 - RC E2E Smoke Harness Script

## 1. Task Summary

Add the missing `e2e:smoke` command required by the Phase 20 RC scenario tickets
so S01 through S10 can run through one reproducible harness.

## 2. Repo Context Discovered

`T339` requires `bun run e2e:smoke -- --scenario s01-registration`. Initial S01
validation at `66252d82` failed at script lookup time because the root
`package.json` had no `e2e:smoke` script.

Existing related scripts include `e2e:core`, `electron:smoke`, and
`electron:ui-smoke:packaged:mac`.

## 3. Files Inspected

- `docs/tickets/T339-rc-s01-multi-tenant-registration.md`
- `docs/release/2026-05-14-rc-evidence.md`
- `package.json`
- `scripts/electron-ui-smoke-packaged-mac.ts`

## 4. Tests Added First

Added `scripts/__tests__/e2e-smoke-harness.test.ts` before implementation.

## 5. Expected Failing Test Output

```text
bun test v1.3.13 (bf2e2cec)

scripts/__tests__/e2e-smoke-harness.test.ts:
error: expect(received).toBe(expected)

Expected: "bun run scripts/e2e-smoke.ts"
Received: undefined

error: Cannot find module '../e2e-smoke'

0 pass
2 fail
```

## 6. Implementation Changes

- Added `scripts/e2e-smoke.ts` with a small scenario registry and CLI parser.
- Added the root `e2e:smoke` package script.
- Routed `s01-registration` to the existing packaged macOS UI smoke path.
- Made unsupported scenario ids fail closed with a supported-scenarios message.
- Made non-darwin S01 execution fail explicitly with exit code 78 instead of
  hanging or falling through to a missing script.

## 7. Validation Commands Run

```bash
bun run e2e:smoke -- --scenario s01-registration
bun run e2e:smoke -- --scenario missing-scenario
bun test scripts/__tests__/e2e-smoke-harness.test.ts
bun run validate:agent-contract
bun run validate:docs
```

## 8. Passing Test Output Summary

- `bun test scripts/__tests__/e2e-smoke-harness.test.ts`: 2 pass, 0 fail, 4
  expectations.
- `bun run e2e:smoke -- --scenario s01-registration`: no longer fails with
  `Script not found`; exits code 78 with explicit message that S01 requires
  `darwin` and this host is `linux`.
- `bun run e2e:smoke -- --scenario missing-scenario`: exits code 1 with
  `Unsupported scenario "missing-scenario". Supported scenarios: s01-registration`.
- `bun run validate:agent-contract`: ok, 11 skills, 306 tickets, 7 required
  docs.
- `bun run validate:docs`: ok, architecture docs and sync-v2 design validated.

## 9. Build Output Summary

No build was run. The change is a harness script and package-script entry point.

## 10. Remaining Risks

- The S01 scenario still needs actual Electron smoke evidence and screenshots
  from a macOS packaged-app host.
- The harness currently supports S01 only. T340 through T348 still need scenario
  registry entries before their `e2e:smoke` invocations can run.

## 11. Acceptance Criteria Matrix

| Criterion | Status | Evidence |
|---|---|---|
| `e2e:smoke` missing state is reproduced | Pass | Initial T352 red test and S01 command failed with script not found |
| Root `e2e:smoke` script exists | Pass | `package.json` maps it to `bun run scripts/e2e-smoke.ts` |
| S01 scenario id is registered | Pass | Harness unit test imports `SUPPORTED_SCENARIOS` |
| Unknown scenario fails closed | Pass | `missing-scenario` exits 1 with supported-scenarios message |
| Non-darwin host fails explicitly | Pass | S01 exits 78 with `requires darwin; current platform is linux` |
| T339 can proceed past script lookup | Pass | S01 now reaches the harness instead of Bun script lookup |
