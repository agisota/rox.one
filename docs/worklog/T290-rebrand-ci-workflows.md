# T290 - Rebrand CI workflow environment and artifact surfaces

Status: DONE
Phase: R.7
Ticket: docs/tickets/T290-rebrand-ci-workflows.md

## 1. Task summary

Lock the GitHub Actions job/step `name:` and artifact-name contract as
canonical ROX.ONE branding. The R.5/R.6 surface sweep already migrated
the affected keys; T290 encodes a regression-prevention test so future
contributors cannot reintroduce `Rox` or `rox-agent-` in those
positions without breaking CI.

## 2. Repo context discovered

Inventory at the start of the cycle showed five workflows under
`.github/workflows/`:

| File | Top-level name | Job name | Artifact name |
|---|---|---|---|
| `e2e-core.yml` | `E2E Core Scenarios` | `ROX ONE core scenario suite` | `e2e-core-logs` |
| `mac-arm-build.yml` | `Mac ARM Build` | `ROX ONE macOS ARM64 package` | `rox-one-mac-arm64` |
| `private-release.yml` | `Private Release Candidate` | `ROX ONE private release gate` | `rox-one-private-release-evidence` |
| `validate-server.yml` | `Validate Server (Integration)` | `validate-server (${{ matrix.os }})` | (none) |
| `validate.yml` | `Validate` | (default) | `validation-logs` |

Every `name:` key already uses canonical ROX.ONE wording where the
brand applies. Every artifact key is rox-namespaced (`rox-one-*`) or
brand-neutral (`e2e-core-logs`, `validation-logs`).

The legacy `ROX_*` env-var keys (`ROX_E2E_FAKE_PROVIDERS`,
`ROX_HEADLESS`, `ROX_DEV_RUNTIME`, `secrets.ROX_ANTHROPIC_API_KEY`)
remain intentionally — they exercise the R.6 readEnv() shim's legacy
fallback path. Renaming them now would short-circuit the deprecation
window R.6 granted.

## 3. Files inspected

- `.github/workflows/e2e-core.yml`
- `.github/workflows/mac-arm-build.yml`
- `.github/workflows/private-release.yml`
- `.github/workflows/validate-server.yml`
- `.github/workflows/validate.yml`

## 4. Tests added first

Two assertions inside `scripts/__tests__/r7-docker-ci-build.test.ts`:

```
test("no GitHub Actions workflow uses 'Rox' in a job or step name", ...)
test("no GitHub Actions workflow uses a rox-agent-* artifact name", ...)
```

The first walks every `.yml` under `.github/workflows/`, matches `^\s*name:`
lines, and asserts the value contains neither `rox-agent` nor (case-
insensitive) `Rox\b`. The second scans for any `rox-agent-` substring
across all workflow lines.

## 5. Expected failing test output

The workflows were already canonical at start of cycle, so both
assertions passed on the initial test run. No red-state was observed
for this ticket specifically; the red-state evidence lives in T289's
Dockerfile assertions where two assertions failed.

This is by design: T290's job is to *prevent* regression, not to fix a
current one. The TDD value of these assertions is that any future
workflow edit that reintroduces `Rox` or `rox-agent-` will fail
the R.7 test immediately.

## 6. Implementation changes

No workflow files edited. Test-only contract added in T289's commit
of `scripts/__tests__/r7-docker-ci-build.test.ts`.

## 7. Validation commands run

- `bun test scripts/__tests__/r7-docker-ci-build.test.ts`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

```
7 pass
0 fail
17 expect() calls
Ran 7 tests across 1 file.
```

The two workflow assertions are tests #4 and #5 of the suite.

## 9. Build output summary

N/A — workflow YAML changes only validate at trigger time; no local
build artifact applies.

## 10. Remaining risks

- The R.10 closeout will need to retire the ROX_* env-var keys in
  workflow YAML once the R.6 shim deprecation window closes. T290 does
  not own that work; it only owns the name-key + artifact-name contract.
- The `secrets.ROX_ANTHROPIC_API_KEY` reference depends on an org-
  level secret. Renaming it requires operator coordination with the
  GitHub Actions secret store and is out of scope for code-only PRs.

## 11. Acceptance criteria matrix

- [x] R.7 test asserts the name-key + artifact-name contract is green.
- [x] No workflow file was edited during T290.
- [x] ROX_* env-var keys remain in workflow YAML to exercise the
      R.6 shim.
