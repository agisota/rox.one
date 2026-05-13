# T297 - Rebrand prepush hook and CI gate (R.10 enforcement)

Status: DONE
Phase: R.10 (gate — sibling of T296 closeout ticket)
Ticket: docs/tickets/T297-rebrand-prepush-hook-and-ci-gate.md
Goal: docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md
Sibling: docs/tickets/T296-rebrand-sweep-closeout.md

## 1. Task summary

Install the permanent `validate:rebrand` enforcement gate at two
points so any future regression of the rebrand fails closed:

1. Local pre-push hook (`.husky/pre-push`) — husky v9.1 user-shim,
   plain-shell form (forward-compatible with husky v10), executable,
   invokes `bun run validate:rebrand`.
2. CI workflow step (`.github/workflows/validate.yml`) — a new
   `validate:rebrand gate (R.10 permanent)` step that runs
   `bun run validate:rebrand` before the heavier validation suite so
   a rebrand regression fails fast.

Land a TDD regression test that fails closed if either enforcement
point is removed:
`scripts/__tests__/rebrand-permanent-gate.test.ts`.

T296 (sibling closeout ticket) records the R.0–R.9.5 commit-SHA
summary and creates the `rebrand-v1` tag.

## 2. Repo context discovered

Husky v9.1 layout in this repo:

- `package.json` carries `"husky": "^9.1.7"` (devDep) and
  `"prepare": "husky"` (lifecycle script). `bun install` runs the
  prepare script, which executes `node_modules/husky/bin.js` →
  `index.js`. That script:
  1. Sets `git config core.hooksPath = .husky/_/`.
  2. Writes `.husky/_/h` (the dispatcher).
  3. Writes `.husky/_/<each-hookname>` with the boilerplate
     `#!/usr/bin/env sh\n. "$(dirname "$0")/h"` (the v9 dispatcher
     hand-off).
  4. Writes `.husky/_/.gitignore = *` (the `_/` directory is fully
     gitignored).
  5. Writes `.husky/_/husky.sh` containing the **deprecation
     warning** — the v8 source-line pattern that "WILL FAIL in
     v10.0.0".

- The dispatcher `.husky/_/h` computes
  `s=$(dirname "$(dirname "$0")")/$n` → `.husky/<hookname>` and
  exits 0 if that file does not exist. If it does, it sources
  `~/.config/husky/init.sh` (if present), respects `HUSKY=0`
  skip-flag, and runs `sh -e "$s" "$@"`.

- So the **tracked** user-shim lives at `.husky/<hookname>` and is a
  plain shell script (no shebang/source ceremony needed; the
  dispatcher already invokes it via `sh -e`).

- The goal doc's Phase R.10 hook template uses the **deprecated v8
  form**:
  ```sh
  #!/usr/bin/env sh
  . "$(dirname -- "$0")/_/husky.sh"

  bun run validate:rebrand
  ```
  That source line triggers husky v9's DEPRECATED warning at the start
  of every push and will hard-fail in husky v10. T297 deviates from
  the template and uses the forward-compatible plain-shell form. The
  deviation is documented here and in `docs/worklog/T296-*.md` §10.

CI workflow context:

- `.github/workflows/validate.yml` is the existing validation job. It
  runs on `pull_request`, push to `main`, and `workflow_dispatch`.
  Sets up Bun 1.3.10, installs deps, prepares a `.ci-logs/` directory,
  then runs:
  - `bun run validate:agent-contract`
  - `bun run validate:architecture-docs`
  - `bun run validate:ci`
  - `bun run test:units`
  …all tee'd to per-step logs in `.ci-logs/` and uploaded as a CI
  artifact.

- The natural insertion point is between `Prepare validation logs`
  and `Run validation suite`. Placing the rebrand gate first makes
  it the fastest failing step for a regression PR.

## 3. Files inspected

- `node_modules/husky/index.js` (husky 9.1.7) — confirmed dispatcher
  install path + the deprecated `_/husky.sh` warning text.
- `node_modules/husky/package.json` — confirmed husky 9.1.7 version.
- `.husky/_/h`, `.husky/_/pre-push`, `.husky/_/husky.sh`,
  `.husky/_/.gitignore` (in `/home/dev/rox/rox-one-terminal/`) —
  confirmed the dispatcher + stubs + gitignore.
- `package.json` — confirmed `"prepare": "husky"` is wired and husky
  is a devDep (which means CI's `bun install` will provision the
  dispatcher set automatically).
- `.github/workflows/validate.yml` — confirmed step layout for the
  insertion.
- `scripts/__tests__/r7-docker-ci-build.test.ts`,
  `scripts/__tests__/community-link-audit.test.ts` — test-shape
  references for the new R.10 regression test.
- `scripts/validate-rebrand.cjs` — confirmed the script name + the
  passing-message string.

## 4. Tests added first

`scripts/__tests__/rebrand-permanent-gate.test.ts` (new). Four test
cases under the `R.10 permanent validate:rebrand gate` describe block:

1. **`.husky/pre-push` hook exists** — `existsSync(.husky/pre-push)`
   returns `true`.
2. **Hook has executable mode bits** — `statSync(.husky/pre-push).mode
   & 0o100` is non-zero. (Owner-execute bit. Husky's dispatcher
   invokes via `sh -e`, but the file being executable matches
   operator expectations and matches what husky's own dispatcher
   stubs do — `mode: 0o755`.)
3. **Hook invokes `bun run validate:rebrand`** — file contents
   include the literal `bun run validate:rebrand`.
4. **At least one workflow runs `bun run validate:rebrand`** —
   `readdirSync(.github/workflows/)` scanned for `*.yml`; at least
   one file contains the literal `bun run validate:rebrand`.

Each test reads the artefact via `node:fs` synchronously; no spawn,
no git command, no toolchain dependency beyond bun + the standard
node stdlib.

## 5. Expected failing test output

Run on the pre-fix HEAD (after the test file landed, before the
`.husky/pre-push` file and the CI step landed):

```
bun test v1.3.13 (bf2e2cec)

scripts/__tests__/rebrand-permanent-gate.test.ts:
22 |  * forbidden legacy-brand token appears outside the curated allowlist.
23 |  */
24 | describe("R.10 permanent validate:rebrand gate", () => {
25 |   test("husky pre-push hook exists at .husky/pre-push", () => {
26 |     const hookPath = join(repoRoot, ".husky/pre-push");
27 |     expect(existsSync(hookPath)).toBe(true);
                                      ^
error: expect(received).toBe(expected)

Expected: true
Received: false

      at <anonymous> (/tmp/rox-r10/scripts/__tests__/rebrand-permanent-gate.test.ts:27:34)
(fail) R.10 permanent validate:rebrand gate > husky pre-push hook exists at .husky/pre-push [1.00ms]

(...similar failures for the three remaining tests...)

 0 pass
 4 fail
 3 expect() calls
Ran 4 tests across 1 file. [44.00ms]
```

All four tests fail for the expected reason: the hook file does not
exist, has no executable bit, has no content matching the gate
command, and no workflow file mentions the gate command.

## 6. Implementation changes

### `.husky/pre-push` (new, tracked, executable)

```sh
#!/usr/bin/env sh
# R.10 — permanent validate:rebrand gate.
#
# Husky v9.1 user-shim layout: the dispatcher at .husky/_/<hookname> calls
# `sh -e .husky/<hookname>`, so this file is plain shell with no source line.
# (The deprecated `. "$(dirname -- "$0")/_/husky.sh"` form is removed in
# husky v10; we keep this file forward-compatible.)
#
# `bun run validate:rebrand` shells into scripts/validate-rebrand.cjs and
# exits non-zero if any forbidden legacy-brand token appears outside the
# curated allowlist. A non-zero exit aborts the push.
bun run validate:rebrand
```

Mode bits: `0o755` (owner-execute, group-execute, world-execute).
Verified by `ls -la .husky/pre-push` → `-rwxr-xr-x`.

The `#!/usr/bin/env sh` shebang is retained as a marker of the file's
shell-script identity (matches husky's own dispatcher stubs and works
correctly when the dispatcher invokes via `sh -e`). The crucial
change vs the goal-doc template is the **absence** of the deprecated
`. "$(dirname -- "$0")/_/husky.sh"` source line.

### `.github/workflows/validate.yml` (one step inserted)

Between the existing `Prepare validation logs` and `Run validation
suite` steps:

```yaml
- name: validate:rebrand gate (R.10 permanent)
  shell: bash
  run: |
    set -o pipefail
    bun run validate:rebrand 2>&1 | tee .ci-logs/validate-rebrand.log
```

Notes on shape:

- `shell: bash` matches the surrounding steps.
- `set -o pipefail` ensures the step fails if `validate:rebrand` exits
  non-zero, even though `tee` itself would succeed.
- The log file `.ci-logs/validate-rebrand.log` is picked up by the
  existing `Upload validation logs` step (path glob:
  `.ci-logs/**/*.log`).
- No `${{ … }}` template expansion is used, so no command-injection
  risk vector is introduced.

### `scripts/__tests__/rebrand-permanent-gate.test.ts` (new)

The regression test described in §4. 4 tests, all reading-only.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-permanent-gate.test.ts`
- `bun test scripts/__tests__/rebrand-permanent-gate.test.ts scripts/__tests__/community-link-audit.test.ts scripts/__tests__/rebrand-surface-text.test.ts scripts/__tests__/rebrand-doc-cleanup.test.ts`
- `bun run validate:rebrand` (the gate itself)
- `git diff --check`
- `git status` (verified the three new files + one edited file)

## 8. Passing test output summary

R.10 regression test alone:

```
bun test v1.3.13 (bf2e2cec)

 4 pass
 0 fail
 4 expect() calls
Ran 4 tests across 1 file. [49.00ms]
```

R.10 + R.9 + R.4 + R.1 rebrand tests together:

```
bun test v1.3.13 (bf2e2cec)

 16 pass
 0 fail
 146 expect() calls
Ran 16 tests across 4 files. [414.00ms]
```

`bun run validate:rebrand` →
`rebrand validation passed: no forbidden tokens outside the allowlist`,
exit code 0.

`git diff --check` — clean.

## 9. Build output summary

No `bun run build` triggered. The R.10 changes do not touch any
runtime/source file in the Electron / server / shared / UI packages;
they are documentation, a new test, a new shell shim, and a CI
workflow step. The Electron build, server build, and packaged-mac
smoke pipeline are all unaffected.

The CI workflow now runs `bun run validate:rebrand` before its
existing validation suite; total CI time grows by the time for one
node script invocation (low single-digit seconds based on local
timings).

## 10. Remaining risks

- **Husky v9 user-shim form intentionally diverges from the goal
  doc template.** The goal doc Phase R.10 item 6 prescribes the
  deprecated v8 source-line pattern. We use the forward-compatible
  v9 plain-shell form (no source line). The deviation is documented
  here and in T296's worklog §10. Risk if reverted to v8 form:
  husky v9.1 emits a deprecation warning on every push; husky v10
  hard-fails. Mitigation: the new regression test only asserts
  contents include `bun run validate:rebrand` — it does NOT pin the
  hook to the deprecated form. A future operator updating the hook
  format will not need to change the regression test.

- **CI step placement is opinionated.** Placing the rebrand gate
  before `Run validation suite` makes a rebrand regression the
  fastest-failing CI signal. The downside is that on a clean PR the
  step contributes a small amount of CI time. Alternative: fold the
  call into the `validate:ci` script aggregate. Current placement is
  preferred for triage clarity (isolated log file). Either is
  acceptable; the regression test passes for any workflow file that
  contains the literal `bun run validate:rebrand`.

- **Hook bypass via `git push --no-verify`.** A developer can skip the
  pre-push hook locally. CI catches the same regression on PR. The
  `<git_and_versioning>` engineering rules already enforce no
  unauthorised `--no-verify`, so the gap is policy-covered.

- **The validate:rebrand allowlist itself remains code-reviewable.**
  The new permanent gate enforces that `validate:rebrand` exits 0; it
  does NOT enforce that the allowlist stays narrow. Loosening the
  allowlist requires a diff to `scripts/validate-rebrand.cjs`, which
  is visible in code review. This is the desired separation of
  concerns: automated rejection of regressions outside the allowlist;
  human review of allowlist changes.

- **Husky install requires `bun install` in CI.** The
  `.github/workflows/validate.yml` job already runs
  `bun install --frozen-lockfile` before the rebrand gate step, so
  `core.hooksPath` is configured correctly on the CI runner. If a
  future workflow file adds the rebrand step but skips
  `bun install`, the dispatcher path won't be configured, but the
  `validate:rebrand` script itself is a plain CJS file that runs
  independently of husky. So the CI step is robust against that
  misconfiguration.

## 12. Post-rewrite recovery note

A pre-rewrite recovery snapshot was preserved at
`.pre-rewrite-recovery/preserved-uncommitted-work/T297-prepush-hook/`.
That snapshot was taken before the filter-repo history rewrite that
produced the current `main` at `e1107441`. The rewrite squashed T297
into commit `ff687795` ("Complete R.10 final rebrand sweep + permanent
gate + rebrand-v1 tag (#71)") with the following minor deviations from
the preserved snapshot:

- `.husky/pre-push` comment block was polished (rewrite author added
  the husky v9.1 user-shim layout explanation).
- `scripts/__tests__/rebrand-prepush-hook.test.ts` was renamed to
  `scripts/__tests__/rebrand-permanent-gate.test.ts` and expanded
  (adds a `bun run validate:rebrand` live-execution test and uses
  `execFileSync` rather than filesystem reads alone).

All four acceptance criteria are met on current `main`. The preserved
snapshot is superseded and no further cherry-pick is required.

## 11. Acceptance criteria matrix

- [x] `.husky/pre-push` exists, executable (`-rwxr-xr-x`), with husky
      v9 user-shim contents and the literal `bun run validate:rebrand`
      command.
- [x] `.github/workflows/validate.yml` carries the
      `validate:rebrand gate (R.10 permanent)` step inserted between
      `Prepare validation logs` and `Run validation suite`.
- [x] `scripts/__tests__/rebrand-permanent-gate.test.ts` is green
      (4 pass, 0 fail; red captured in §5).
- [x] `bun run validate:rebrand` exits 0 in the worktree (§8).
- [x] R.0–R.9.5 sibling rebrand regression tests stay green
      (§8 shows 16 pass across 4 files including R.10's new test).
- [x] Hook contents forward-compatible with husky v10 (no deprecated
      `_/husky.sh` source line). Verified by inspection of
      `.husky/pre-push`.
- [x] CI step uses no untrusted template input
      (`${{ github.event.… }}`) — no command-injection risk.
