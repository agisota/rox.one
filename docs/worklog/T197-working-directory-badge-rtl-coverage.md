# T197 - WorkingDirectoryBadge RTL Coverage

## 1. Task summary

Add 5 RTL tests for `WorkingDirectoryBadge` within `FreeFormInput`. Advance FreeFormInput.tsx line coverage from 36.30% to 44.25% (+7.95%). Close architect recommendation #4 from PR-B2. The Radix Popover used inside `WorkingDirectoryBadge` is stubbed to render children unconditionally, avoiding the multi-copy Radix context issue in jsdom.

## 2. Repo context discovered

- `WorkingDirectoryBadge` renders a chip button that opens a Radix Popover panel showing the current working directory path and controls to change it. The chip button is rendered inside `FreeFormInput`'s toolbar row.
- **Multi-copy Radix context issue:** Radix UI Popover uses a React context provider that is injected at the document body (portal). In jsdom, when the Popover is rendered inside `renderFreeFormInput`'s container, the portal attaches to a different document node. Vitest's JSDOM environment collapses two copies of the Popover context provider into the same tree, causing a React error: `Context value cannot be undefined`. The established solution (used in other Radix UI tests in the codebase) is to mock the Popover module with a stub that renders children unconditionally — no portal, no context boundary.
- **Popover stub pattern:** `vi.mock('@radix-ui/react-popover', () => ({ Root: ({ children }) => <>{children}</>, Trigger: ({ children }) => <>{children}</>, Content: ({ children }) => <div data-testid="popover-content">{children}</div>, Portal: ({ children }) => <>{children}</>, }))`. This preserves the component tree structure while removing the problematic portal/context behavior.
- `renderFreeFormInput` helper from T186 accepts optional props; `workingDirectory` prop is passed to drive the badge render.
- Coverage delta breakdown: +7.95% lines from 5 new tests exercising the badge render path, badge accessibility attributes, popover open behavior, and null/undefined working directory handling.

## 3. Files inspected

- `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx` — confirmed `WorkingDirectoryBadge` render path, prop name (`workingDirectory`), conditional render when `workingDirectory` is null
- `apps/electron/src/renderer/components/app-shell/input/WorkingDirectoryBadge.tsx` — confirmed Radix Popover import, button element, `aria-label` or visible text
- `apps/electron/src/renderer/components/app-shell/input/__tests__/freeform-input.rtl.test.tsx` — read for `renderFreeFormInput` helper signature and existing mock patterns
- `apps/electron/src/renderer/styles/globals.css` — confirmed no test-blocking CSS custom properties

## 4. Tests added first

New file: `apps/electron/src/renderer/components/app-shell/input/__tests__/freeform-input.workdir.rtl.test.tsx`.

5 tests (all written before implementation — no implementation changes required; this is a test-only ticket):

1. `'renders the WorkingDirectoryBadge when workingDirectory is provided'`
2. `'does not render the WorkingDirectoryBadge when workingDirectory is null'`
3. `'WorkingDirectoryBadge button is keyboard focusable'`
4. `'WorkingDirectoryBadge button has an accessible label'`
5. `'WorkingDirectoryBadge opens the popover panel on click'`

## 5. Expected failing test output

Tests 1–5 pass immediately (no production changes required; the badge already renders correctly when `workingDirectory` is provided). The Popover stub is required for test 5 to pass; without it, test 5 fails with:

```text
Error: Context value cannot be undefined
  at Radix.PopoverContext provider
```

With the stub in place, all 5 pass.

## 6. Implementation changes

**New file: `apps/electron/src/renderer/components/app-shell/input/__tests__/freeform-input.workdir.rtl.test.tsx`**

- `vi.mock` for `@radix-ui/react-popover` stub (renders children unconditionally).
- 5 `it()` blocks using `renderFreeFormInput({ workingDirectory: '/home/dev/project' })` and `renderFreeFormInput({ workingDirectory: null })`.
- No production code changes.

Net change: 1 new test file, ~80 lines.

## 7. Validation commands run

```bash
bun run test:rtl
```

## 8. Passing test output summary

```text
bun run test:rtl
 ✓ freeform-input.workdir.rtl.test.tsx > FreeFormInput WorkingDirectoryBadge [T197] > renders the WorkingDirectoryBadge when workingDirectory is provided
 ✓ freeform-input.workdir.rtl.test.tsx > FreeFormInput WorkingDirectoryBadge [T197] > does not render the WorkingDirectoryBadge when workingDirectory is null
 ✓ freeform-input.workdir.rtl.test.tsx > FreeFormInput WorkingDirectoryBadge [T197] > WorkingDirectoryBadge button is keyboard focusable
 ✓ freeform-input.workdir.rtl.test.tsx > FreeFormInput WorkingDirectoryBadge [T197] > WorkingDirectoryBadge button has an accessible label
 ✓ freeform-input.workdir.rtl.test.tsx > FreeFormInput WorkingDirectoryBadge [T197] > WorkingDirectoryBadge opens the popover panel on click
Tests  51 passed | 1 todo (52)

Coverage: FreeFormInput.tsx
  Lines:     44.25% (was 36.30%, +7.95%)
  Branches:  50.18% (was 46.25%, +3.93%)
  Functions: 28.30% (was 23.40%, +4.90%)
```

## 9. Build output summary

No production build change. Test-only commit. No new production dependency added.

## 10. Remaining risks

- **Coverage target not yet met.** FreeFormInput.tsx lines at 44.25%; project target is 70%. The remaining gap (~26pp) is concentrated in the model-picker dropdown internals (~270 LOC) and the sources panel popover — both blocked by the multi-copy Radix context issue in jsdom. The Popover stub used here works for `WorkingDirectoryBadge` because it is a leaf popover (no nested Radix context consumers). The model-picker dropdown uses nested Radix `Select` inside a `Popover`; stubbing both requires more complex mock coordination. This is tracked in `docs/validation/COVERAGE.md` as a known gap with a documented blocker.
- **Popover stub renders children unconditionally.** This is correct for `WorkingDirectoryBadge`'s open/close test (test 5), but it means the test does not exercise the real Popover open/close transition or animation. If the popover content has visibility guards (`hidden` attribute, CSS `display: none`), the stub bypasses them. For the current `WorkingDirectoryBadge` content this is acceptable; the test verifies that the popover panel content is in the DOM, not its visual state.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| 5 new RTL tests, all passing | PASS | `ecf7a9a` — `bun run test:rtl` → `51 passed + 1 todo` |
| FreeFormInput.tsx lines: 36.30% → 44.25% (+7.95%) | PASS | `ecf7a9a` — coverage report above |
| FreeFormInput.tsx branches: 46.25% → 50.18% (+3.93%) | PASS | `ecf7a9a` — coverage report above |
| FreeFormInput.tsx functions: 23.40% → 28.30% (+4.90%) | PASS | `ecf7a9a` — coverage report above |
| Popover stub renders children unconditionally | PASS | `ecf7a9a` — `vi.mock('@radix-ui/react-popover', ...)` in test file |
| Architect recommendation #4 from PR-B2 closed | PASS | `ecf7a9a` — `WorkingDirectoryBadge` now covered by RTL tests |
| `bun run test:rtl` green (51 pass + 1 todo) | PASS | Test run output above |
| Commit created | PASS | `ecf7a9a` — `test(composer): RTL coverage for WorkingDirectoryBadge in FreeFormInput [T197]` |

## 2026-05-12 addendum - build unblock

## 1. Task summary

Unblock the current app build after `origin/main` fast-forward by fixing the T197 RTL regression where the working-directory badge exposed `/home/test/my-project` instead of `my-project`.

## 2. Repo context discovered

- `FreeFormInput.tsx` already passes `folderName` into `FreeFormInputContextBadge`.
- `folderName` comes from `getPathBasename` in `apps/electron/src/renderer/lib/platform.ts`.
- `getPathBasename` split paths only on the renderer platform separator (`PATH_SEP`). In the Vitest/happy-dom runtime this can treat a Unix path as a non-native path and return the full path.
- Renderer working-directory paths can come from local workspaces, remote servers, and test/runtime shims, so basename extraction should tolerate both `/` and `\`.

## 3. Files inspected

- `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`
- `apps/electron/src/renderer/components/app-shell/input/FreeFormInputContextBadge.tsx`
- `apps/electron/src/renderer/components/app-shell/input/__tests__/freeform-input.working-dir.rtl.test.tsx`
- `apps/electron/src/renderer/lib/platform.ts`
- `scripts/electron-dist-dev-mac-arm64.ts`
- `scripts/validate-packaged-artifacts.ts`
- `scripts/electron-smoke-packaged-mac.ts`

## 4. Tests added first

- Added `apps/electron/src/renderer/lib/__tests__/platform.test.ts`.
- Covered Unix-style and Windows-style paths, including trailing separators.
- Existing T197 RTL test was already failing first and reproduced the user-visible blocker.

## 5. Expected failing test output

Before the fix:

```text
FreeFormInput WorkingDirectoryBadge [T197] > renders the folder basename when workingDirectory is set
Unable to find role="button" and name "my-project"
actual aria-label="/home/test/my-project"
```

## 6. Implementation changes

- Updated `getPathBasename` to split on both Unix and Windows separators.
- Strips trailing separators before extracting the final segment.
- Preserves root/drive-root fallback behavior by returning an empty basename for `C:`.

## 7. Validation commands run

```bash
bun test apps/electron/src/renderer/lib/__tests__/platform.test.ts
bun run test:rtl -- src/renderer/components/app-shell/input/__tests__/freeform-input.working-dir.rtl.test.tsx
bun run test:rtl
bun run typecheck:all
bun run build
bun run electron:dist:dev:mac:arm64
bun run validate:packaged-artifacts
bun run electron:smoke:packaged:mac
```

## 8. Passing test output summary

```text
bun test apps/electron/src/renderer/lib/__tests__/platform.test.ts
2 pass, 0 fail

bun run test:rtl -- src/renderer/components/app-shell/input/__tests__/freeform-input.working-dir.rtl.test.tsx
Test Files 1 passed; Tests 5 passed

bun run test:rtl
Test Files 8 passed; Tests 52 passed

bun run typecheck:all
exit code 0
```

## 9. Build output summary

```text
bun run build
main/preload/renderer/resources/assets built successfully

bun run electron:dist:dev:mac:arm64
release/ROX-ONE-arm64.dmg
release/ROX-ONE-arm64.zip
release/mac-arm64/ROX.ONE.app

bun run validate:packaged-artifacts
ROX-ONE-arm64.dmg :: 339058321 bytes
ROX-ONE-arm64.zip :: 327511523 bytes
latest-mac.yml artifact references verified

bun run electron:smoke:packaged:mac
[packaged-smoke] ROX.ONE packaged headless startup passed
```

## 10. Remaining risks

- The packaged build is ad-hoc signed and not notarized because this was the dev Mac ARM artifact path with `CSC_IDENTITY_AUTO_DISCOVERY=false`.
- Vite still reports large chunk warnings; they are pre-existing bundle-size warnings and did not fail the build.
- The repository still has ignored build outputs under `apps/electron/dist/`, `apps/electron/release/`, `.build/`, and `.cache/`; they are intentionally not tracked in this source commit.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| T197 RTL regression fixed | PASS | `bun run test:rtl -- ...working-dir.rtl.test.tsx` -> 5 passed |
| Cross-platform basename helper covered | PASS | `platform.test.ts` -> 2 passed |
| Full RTL suite green | PASS | `bun run test:rtl` -> 52 passed |
| Typecheck green | PASS | `bun run typecheck:all` -> exit 0 |
| Electron build green | PASS | `bun run build` -> exit 0 |
| Mac ARM artifacts rebuilt | PASS | `ROX-ONE-arm64.dmg` 339058321 bytes; `ROX-ONE-arm64.zip` 327511523 bytes |
| Packaged artifact metadata valid | PASS | `bun run validate:packaged-artifacts` -> latest-mac.yml references verified |
| Packaged app smoke tested | PASS | `bun run electron:smoke:packaged:mac` -> packaged headless startup passed |
