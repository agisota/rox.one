# Worklog — T550 PZD-84 Rox Design view cleanup

## 1. Task summary
Fix PZD-84 / audit finding C-H4 by making Rox Design embedded-view skin CSS and WebContents listeners explicitly disposable.

## 2. Repo context discovered
- `RoxDesignViewManager` owns the embedded `BrowserView`/`WebContentsView` lifecycle.
- `applyEmbedSkin()` stores an `insertCSS()` key in `skinCssKey`, but current code only inserts when the key is absent.
- `configureWebContents()` registers `will-navigate`, `did-start-navigation`, `dom-ready`, `did-finish-load`, and `did-fail-load` listeners.
- `destroyEntry()` currently disposes the theme bridge and closes WebContents, but does not unregister those listeners.

## 3. Files inspected
- `apps/electron/src/main/rox-design-view-manager.ts`
- `apps/electron/src/main/rox-design-embed-skin.ts`
- `apps/electron/src/main/__tests__/rox-design-view-manager.test.ts`
- `apps/electron/src/main/__tests__/rox-design-view-manager.partition.test.ts`
- `docs/tickets/T537-packaged-renderer-react-chunk.md`
- `docs/worklog/T537-packaged-renderer-react-chunk.md`

## 4. Tests added first
- `apps/electron/src/main/__tests__/rox-design-view-manager-cleanup.test.ts`

## 5. Expected failing test output
Initial RED run:

```text
bun test apps/electron/src/main/__tests__/rox-design-view-manager-cleanup.test.ts
0 pass
3 fail
Expected removeInsertedCSS call count 2, received 0
Expected removeInsertedCSS call count 1, received 0
Expected removeAllListeners call count 1, received 0
```

## 6. Implementation changes
- `RoxDesignViewManager.applyEmbedSkin()` now removes any previous `insertCSS()` key before inserting the next ROX skin sheet.
- Stale-key removal failures are logged as warnings and do not block fresh CSS insertion.
- `destroyEntry()` now removes the stored skin CSS key, unregisters WebContents listeners, and then closes WebContents.
- Added focused cleanup regression coverage.

## 7. Validation commands run
```text
bun test apps/electron/src/main/__tests__/rox-design-view-manager-cleanup.test.ts
bun test apps/electron/src/main/__tests__/rox-design-view-manager.test.ts apps/electron/src/main/__tests__/rox-design-view-manager.partition.test.ts apps/electron/src/main/__tests__/rox-design-view-manager-cleanup.test.ts
bun run typecheck:electron
git diff --check
```

## 8. Passing test output summary
```text
RoxDesignViewManager cleanup: 3 pass, 0 fail
RoxDesignViewManager helper/partition/cleanup pack: 11 pass, 0 fail
typecheck:electron: passed
git diff --check: passed
```

## 9. Build output summary
Not required unless the focused Electron surface indicates a broader build risk.

## 10. Remaining risks
- This branch is intentionally stacked on the PR #330 CI-contract branch because that branch carries the current Electron typecheck baseline repairs.
- The cleanup is covered with mocked Electron WebContents; real long-session leak behavior still depends on packaged/manual runtime observation.

## 11. Acceptance criteria matrix
| Criterion | Status | Evidence |
| --- | --- | --- |
| Previous CSS key removed before reinsertion | Passing | Cleanup regression test |
| Stale `removeInsertedCSS` key does not block new CSS | Passing | Cleanup regression test |
| WebContents listeners removed during destroy | Passing | Cleanup regression test |
| Focused tests pass | Passing | 11 RoxDesignViewManager tests pass |
| Electron typecheck passes on current baseline | Passing | `bun run typecheck:electron` |
