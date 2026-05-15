# Test Runner Drift Investigation — 2026-05-15

Status: Deferred to v1.0.x
Ticket: [T505 — Test Runner Drift](../tickets/T505-test-runner-drift.md)
Reproduction base: `c07100a96a89cb310cdd029d5d949ddc36ffabad` (origin/main at investigation time)
Doc-current base: `fc97de334b8208f752db07aa5d420c5ede039c7d` (origin/main HEAD; docs-only delta — no test-surface change)
Runner: `bun:test v1.3.13` and `vitest` via `apps/electron/vitest.config.ts`

## Executive summary

The MEMORY.md note `bun:test vs vitest discovery drift` reports "100 unit fails
on main 2026-05-14 = test-infra drift". This investigation reproduced the run
on origin/main HEAD and found that:

1. `bun test` itself is **green** on origin/main: 6918 pass, 13 skip, 0 fail,
   27576 expect() calls, 566 files, 169.44s wall.
2. The 55 failures (across 9 files) all surface under `bun run test:rtl`
   (Vitest + happy-dom), with the **same** error every time:
   `useModalRegistry must be used within a ModalProvider`.
3. There is **no discovery drift**. bun:test and Vitest partition the test
   surface cleanly via `bunfig.toml pathIgnorePatterns` (excludes
   `**/*.rtl.test.tsx`) and `vitest.config.ts` (`include: ['src/**/*.rtl.test.tsx']`).
   File counts on disk (26 `*.rtl.test.tsx`) match Vitest's collected count (26).
4. The "drift" framing in MEMORY is misleading. The real failure is a
   missing `ModalProvider` wrapper in the shared RTL render helper
   (`apps/electron/src/test-utils/render.tsx`). Adding it fixes all 9 files
   in one diff. That surface is owned by C1 in the current parallel-agent
   sprint allocation, so the fix is deferred here — see "Coordination" below.

## Reproduction

```bash
git checkout c07100a9   # any HEAD on or after this; no test-surface change since
bun test 2>&1 | tail -10
# → 6918 pass / 13 skip / 0 fail / Ran 6931 tests across 566 files. [169.44s]

bun run test:rtl 2>&1 | tail -10
# → Test Files  9 failed | 17 passed (26)
#       Tests  55 failed | 104 passed (159)
```

## Failure inventory

All 9 failing files are in
`apps/electron/src/renderer/components/app-shell/input/__tests__/`:

| File | Tests failed |
|------|---:|
| `freeform-input.thinking-level.rtl.test.tsx` | 5/5 |
| `freeform-input.slash-mention.rtl.test.tsx` | 5/5 |
| `freeform-input.mode-switching.rtl.test.tsx` | 5/5 |
| `freeform-input.attachments.rtl.test.tsx` | 5/5 |
| `freeform-input.send.rtl.test.tsx` | 8/8 |
| `freeform-input.working-dir.rtl.test.tsx` | 5/5 |
| `freeform-input.history.rtl.test.tsx` | 8/8 |
| `freeform-input.emphasis.rtl.test.tsx` | 12/12 |
| `product-mode-toolbar.rtl.test.tsx` | 2/2 |
| **Total** | **55** |

Every failure terminates with the identical error:

```
useModalRegistry must be used within a ModalProvider
```

The 17 passing RTL files do not invoke any component that calls
`useModalRegistry` and therefore are unaffected.

## Root cause

The shared RTL render helper at
`apps/electron/src/test-utils/render.tsx` exposes a `TestComposerHarness`
provider tree (Jotai + i18n + ReducedMotion + Tooltip) but does **not** wrap
`ModalProvider` from
`apps/electron/src/renderer/context/ModalContext.tsx`. The FreeFormInput
composer surface and any descendant that depends on
`useModalRegistry` therefore throw the
`must be used within a ModalProvider` invariant at render time.

`paste-image-preview-dialog.rtl.test.tsx` and
`freeform-input.send.rtl.test.tsx` already wrap their own subtree with
`ModalProvider`, but the other 9 do not — which is why they fail
deterministically.

This is a **test-harness regression**, not a runtime regression: the actual
production tree wraps `App.tsx` with `ModalProvider`.

## Recommended fix

Add `ModalProvider` to `TestComposerHarness` in
`apps/electron/src/test-utils/render.tsx`. One-line wrapper insert. The
provider is a `React.Context` over a `useRef<Map>` with no side effects, so
it is safe to wrap unconditionally — the priority/close mechanics only
activate when components call `registerModal()`.

```tsx
// In apps/electron/src/test-utils/render.tsx
import { ModalProvider } from '@/context/ModalContext'

// Inside TestComposerHarness:
<JotaiProvider store={jotaiStore}>
  <I18nextProvider i18n={i18n}>
    <ReducedMotionProvider>
      <ModalProvider>            {/* ← add this wrapper */}
        <TooltipProvider>{children}</TooltipProvider>
      </ModalProvider>
    </ReducedMotionProvider>
  </I18nextProvider>
</JotaiProvider>
```

Estimated effort: **<30 minutes** (one-line wrapper + re-run RTL suite to
confirm 159/159 green). Owner: **T504 / C1**.

## Coordination with other agents

A parallel branch `fix/T504-rtl-modal-provider-wrap` exists in the active
worktree set. T504 is the canonical fix lane for the `ModalProvider` wrap.
This T505 ticket is investigation-only and intentionally does not race T504.
Once T504 merges, re-running `bun run test:rtl` is the single validation
needed to confirm closure of the "100 unit fails" claim.

## Secondary observation (out of scope for this ticket)

The `test:units` npm script's isolated-file loop iterates over
`find . -name '*.isolated.ts' -not -path './node_modules/*' -not -path
'./apps/electron/release/*'`, which **does not exclude `.claude/worktrees/`**.
With 20+ active agent worktrees on disk, the loop runs each of the 6 unique
isolated files 70+ times (436 invocations total). This is the cause of
`bun run test:units` exceeding 3-minute wall clocks in worktree-rich envs.

The fix is to add `-not -path './.claude/*'` to the `find` invocation in
`package.json` `scripts.test:units`. This is a one-character change but is
deferred here because it is unrelated to the "drift" investigation; track
as a follow-up.

## Status

- **DEFERRED to v1.0.x.** Fix is well-understood, low-risk, and owned by
  T504 / C1.
- No deferral risk for v1.0.0-rc.1 RC2: RTL test harness is dev-only, the
  failures do not gate any production artifact, and the v1.0.0-rc.1 release
  evidence
  (`docs/release/2026-05-14-rc-evidence.md`) does not depend on this surface.
- This investigation **corrects** the MEMORY.md framing — the "drift" is
  not a bun:test vs Vitest config mismatch; it is a single missing provider
  in the render helper.

## References

- `bunfig.toml` — `pathIgnorePatterns = ["**/*.rtl.test.tsx", …]`
- `apps/electron/vitest.config.ts` — `include: ['src/**/*.rtl.test.tsx']`
- `apps/electron/src/test-utils/render.tsx` — shared RTL render harness
- `apps/electron/src/renderer/context/ModalContext.tsx` — `ModalProvider`
  definition
- MEMORY.md note: `bun:test vs vitest discovery drift`
