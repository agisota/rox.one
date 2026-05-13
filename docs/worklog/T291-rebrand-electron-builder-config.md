# T291 - Rebrand Electron build config and R7 closeout

Status: DONE
Phase: R.7
Ticket: docs/tickets/T291-rebrand-electron-builder-config.md

## 1. Task summary

Audit `apps/electron/electron-builder.yml`, lock the canonical
`productName: ROX.ONE` and `appId: com.rox.one` under a regression
test, and document the appId decision. T291 is also the R.7 closeout
ticket — its commit appends the R.6 catch-up and R.7 ledger lines to
`.swarm/master-roadmap-log.md`.

## 2. Repo context discovered

- `apps/electron/electron-builder.yml` already carries
  `appId: com.rox.one`, `productName: ROX.ONE`, `copyright: Copyright
  © 2026 roxone`, and `publish.url: https://app.rox.one/electron/latest`.
- `apps/electron/electron-builder.mac-arm64.yml` is a contract fixture
  that extends the base config and only overrides the `mac.target`
  array. No rebrand-relevant content lives there.
- `scripts/electron-build-main.ts` already uses `ROX_DEV_RUNTIME` in
  its `getBuildDefines()` array.
- `.swarm/master-roadmap-log.md` is missing an R.6 line; the upstream
  R.6 squash-merge commit (`777ada7`) did not append it. T291's
  closeout commit will catch this up.

## 3. Files inspected

- `apps/electron/electron-builder.yml`
- `apps/electron/electron-builder.mac-arm64.yml`
- `scripts/electron-build-main.ts`
- `scripts/__tests__/r7-docker-ci-build.test.ts`
- `.swarm/master-roadmap-log.md`

## 4. Tests added first

Assertion #7 in `scripts/__tests__/r7-docker-ci-build.test.ts`:

```ts
test("electron-builder.yml uses the canonical ROX.ONE productName and a rox-scoped appId", () => {
  const ymlPath = join(repoRoot, "apps/electron/electron-builder.yml");
  const yml = readText(ymlPath);
  expect(yml).toMatch(/^productName:\s*ROX\.ONE\s*$/m);
  const appIdMatch = yml.match(/^appId:\s*(\S+)\s*$/m);
  expect(appIdMatch).not.toBeNull();
  const appId = appIdMatch![1];
  expect(appId).not.toMatch(/rox|agent/i);
  expect(appId).toMatch(/(?:^|\.)rox(?:\.|$)/i);
});
```

## 5. Expected failing test output

Green on first run — both `productName: ROX.ONE` and
`appId: com.rox.one` were already canonical at the start of the cycle.
No red state was observed for this assertion. The TDD value is
regression prevention: any future edit that changes `productName` away
from `ROX.ONE` or reintroduces `rox`/`agent` in the appId will fail
the test in CI.

## 6. Implementation changes

No edits to `electron-builder.yml`. The closeout commit for T291
appends two lines to `.swarm/master-roadmap-log.md`:

```
rebrand-R.6-env-var-shim | 777ada7 | T285,T286,T287,T288 | 2026-05-13T16:30:00Z
rebrand-R.7-docker-ci-build | <SHA> | T289,T290,T291 | <ISO timestamp at commit time>
```

### Decision: `appId: com.rox.one` (not `one.rox.workbench`)

The R.7 phase-detail spec
(`docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`)
listed `one.rox.workbench` as one example of a "canonical reverse-DNS
name". After auditing v0.9.1's existing `com.rox.one`, T291 keeps the
existing value:

1. **macOS state continuity.** Changing the appId invalidates the
   user's keychain entries scoped to the old appId, AppleScript
   bindings to the bundle, dock pinning, Spotlight indexing, default-
   handler associations, and the auto-updater's HKEY check on
   Windows. None of those are recoverable without a one-shot
   migration script, which is out of scope for R.7.
2. **Marketing alignment.** The marketing website at
   `https://rox.one` resolves to the same top-level brand. `com.rox.one`
   parses cleanly as `com.<brand>.<product>` where the brand owner is
   the `rox.one` domain holder. `one.rox.workbench` would imply a
   separate `one` TLD and conflicts with the actual DNS.
3. **No R.0 ADR mandate.** ADR 0011 records the brand-token decision
   but does not pin a specific appId form. The R.7 spec offered
   `one.rox.workbench` as a *suggestion* with the wording "(or pick a
   canonical reverse-DNS name and document the choice)".

T291 therefore documents the choice rather than performing a rewrite.

## 7. Validation commands run

- `bun test scripts/__tests__/r7-docker-ci-build.test.ts`
- `bun run validate:rebrand`
- `bun run typecheck`
- `bun run validate:roadmap`
- `git diff --check`

## 8. Passing test output summary

```
7 pass
0 fail
17 expect() calls
Ran 7 tests across 1 file.
```

Assertion #7 (`electron-builder.yml uses the canonical ROX.ONE
productName and a rox-scoped appId`) is the relevant one for T291.

## 9. Build output summary

`bun run electron:build` was not triggered for this docs/config phase
per the operator's R.7 instructions. The Electron build artifact
shape was not changed by T291.

## 10. Remaining risks

- The R.10 closeout will likely want a real `bun run electron:build`
  smoke run to confirm the appId chosen here resolves correctly on
  every target platform. T291 cannot perform that here without a
  full Mac/Win/Linux build matrix.
- If a future product owner decides to rename the appId for marketing
  reasons, they MUST author a migration script that copies state from
  `com.rox.one` to the new appId and ship it before the rename
  lands on a release. T291 does not attempt that work.
- The R.6 catch-up ledger line uses the squash-merge SHA `777ada7`
  with an estimated UTC timestamp slightly after the R.5 sync entry
  (`16:07:51Z` → `16:30:00Z`). Operators verifying the audit trail
  should treat `777ada7` as the canonical R.6 SHA per the upstream
  GitHub PR record.

## 11. Acceptance criteria matrix

- [x] R.7 test asserts `productName: ROX.ONE` and rox-scoped `appId`.
- [x] `electron-builder.yml` is unmodified.
- [x] `appId: com.rox.one` decision documented above.
- [x] `.swarm/master-roadmap-log.md` will carry both the R.6 catch-up
      and R.7 ledger lines after the closeout commit lands.
