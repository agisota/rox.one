# T506 — Vitest config consolidation

Status: DONE
Phase: M.19
Ticket: docs/tickets/T506-vitest-config-consolidation.md

## 1. Task summary

Extract a shared Vitest base config (`vitest.shared.config.ts`) at the repo root and
update `apps/electron/vitest.config.ts` to extend it via `mergeConfig()`. Creates
infrastructure for consistent vitest baselines across future consumers.

## 2. Repo context discovered

- Only one vitest consumer in the repo: `apps/electron` (RTL tests).
- All other packages use bun's native test runner — no vitest config needed.
- `apps/electron/vitest.config.ts` had standalone `defineConfig` with coverage settings.

## 3. Files inspected

- `apps/electron/vitest.config.ts`
- `package.json` (scripts)
- `docs/tickets/T506-vitest-config-consolidation.md`

## 4. Tests added first

Refactor-only change. RED check:

```bash
test ! -f vitest.shared.config.ts
```

Exited 0 before implementation.

## 5. Expected failing test output

Shared config file absent; `apps/electron/vitest.config.ts` used standalone defineConfig.

## 6. Implementation changes

- Created `vitest.shared.config.ts` with shared globals/coverage base.
- Updated `apps/electron/vitest.config.ts` to use `mergeConfig(sharedConfig, defineConfig(...))`.
- Removed ~9 lines of duplicate coverage/globals config from electron config.

## 7. Validation commands run

```bash
bun run test:rtl
bun run typecheck:all
bun run test:units
```

## 8. Passing test output summary

```text
bun run test:rtl: 55 failed | 104 passed (pre-existing failures, matches baseline)
bun run typecheck:all: exit 0
bun run test:units: confirmed unaffected
```

## 9. Build output summary

No build changes. Config-only refactor; runtime behaviour unchanged.

## 10. Remaining risks

None. Pre-existing RTL failures are owned by C1/C2 and pre-date this ticket.

## 11. Acceptance criteria matrix

| Criterion | Status |
|---|---|
| `vitest.shared.config.ts` created at repo root | PASS |
| Electron config extends shared base via `mergeConfig` | PASS |
| RTL test count matches pre-change baseline | PASS |
| `typecheck:all` passes | PASS |
