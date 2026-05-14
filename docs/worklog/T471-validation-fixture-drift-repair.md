# T471 - IPC channel fixture drift repair

Status: DONE
Phase: IPC channel fixture drift repair
Ticket: docs/tickets/T471-validation-fixture-drift-repair.md

## 1. Task summary

Repair the stale IPC channel snapshot data found during the T470 full-suite run.
The i18n failures from the same run are tracked separately in T472.

## 2. Repo context discovered

`packages/shared/src/protocol/channels.ts` already defines
`RPC_CHANNELS.audit.LIST` as `audit.list`. The Electron IPC snapshot test
imports the protocol re-export and compares it with a static expected list.
Explorer review confirmed the referenced generator script is not present in
this checkout and prior T332/T346 repairs updated the fixture directly.

## 3. Files inspected

- `apps/electron/src/shared/__tests__/ipc-channels.test.ts`
- `packages/shared/src/protocol/channels.ts`
- `scripts/sort-locales.ts`

## 4. Tests added first

No new tests were needed; the existing IPC snapshot validator was already
failing for the target drift.

## 5. Expected failing test output

`bun test apps/electron/src/shared/__tests__/ipc-channels.test.ts` failed
because expected channel count was 316 but actual count was 317, with received
extra channel `audit.list`.

## 6. Implementation changes

Added `'audit.list'` to
`apps/electron/src/shared/__tests__/ipc-channels.test.ts` in sorted order. No
runtime channel definitions were changed.

## 7. Validation commands run

- `bun test apps/electron/src/shared/__tests__/ipc-channels.test.ts`
- `git diff --check`

## 8. Passing test output summary

`bun test apps/electron/src/shared/__tests__/ipc-channels.test.ts` passed:
5 pass, 0 fail, 5 expect() calls. The count assertion now expects 317 channel
strings.

## 9. Build output summary

Not applicable; this ticket changes a test fixture only.

## 10. Remaining risks

The IPC snapshot comment still references `scripts/ipc-inventory.ts`, but that
file is not present in this checkout. This ticket follows prior manual repair
practice instead of inventing generation machinery.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| IPC channel stability test passes with `audit.list` represented | PASS | `bun test apps/electron/src/shared/__tests__/ipc-channels.test.ts`: 5 pass, 0 fail |
| No runtime channel definitions are changed | PASS | Diff is limited to the IPC test fixture and ticket/worklog |
