# T475 - CircleCI validation bridge

Status: DONE
Phase: CI execution unblocker
Ticket: docs/tickets/T475-circleci-validation-bridge.md

## 1. Task summary

Add a real CircleCI validation bridge so PR #217 and stacked PR #218 can be
validated on CircleCI while GitHub Actions jobs are unable to start because of
the account billing lock.

## 2. Repo context discovered

The repository has GitHub workflows for validate, secret scan, e2e core, and
mac ARM build gates. CircleCI has the project registered, but the registered
CircleCI setup branch only contains the generated sample workflow, while the
PR branches have no `.circleci/config.yml`.

## 3. Files inspected

- `AGENTS.md`
- `package.json`
- `.github/workflows/validate.yml`
- `.github/workflows/secret-scan.yml`
- `.github/workflows/e2e-core.yml`
- `.github/workflows/mac-arm-build.yml`
- `docs/tickets/T473-r11-post-t470-audit-refresh.md`
- `docs/worklog/T473-r11-post-t470-audit-refresh.md`

## 4. Tests added first

No production test was added because this is CI configuration only. The
pre-change guard is the absence check for `.circleci/config.yml` at the
current `HEAD`, followed by YAML parse and CI-contract validators after adding
the config.

## 5. Expected failing test output

Before the change, the target branch had no CircleCI config:

```text
git show HEAD:.circleci/config.yml
fatal: path '.circleci/config.yml' exists on disk, but not in 'HEAD'
```

## 6. Implementation changes

- Added `.circleci/config.yml`.
- Added reusable install/cache commands for Bun and uv.
- Added a Linux `validate` job that mirrors the existing GitHub validate gate.
- Added a Linux `secret-scan` job using Gitleaks with redaction enabled.
- Added macOS `e2e-core` and `mac-arm-build` jobs using the CircleCI macOS
  executor.
- Added this T475 ticket and worklog.

## 7. Validation commands run

- `git diff --check`
- `bun -e "import fs from 'node:fs'; import yaml from 'js-yaml'; const cfg = yaml.load(fs.readFileSync('.circleci/config.yml','utf8')); if (!cfg?.jobs?.validate || !cfg?.workflows?.ci) throw new Error('invalid CircleCI config shape'); console.log(Object.keys(cfg.jobs).join(','));"`
- `bun run validate:docs`
- `bun run validate:ci-contract`

## 8. Passing test output summary

YAML parse output listed all expected CircleCI jobs:

```text
validate,secret-scan,e2e-core,mac-arm-build
```

`bun run validate:ci-contract` passed:

```text
[ci-contract] ok: workflow, package scripts, and validator fixture checks passed
```

`bun run validate:docs` passed: 11 skills, 441 tickets, 7 required docs; 4
architecture docs with 10 subsystem headings; sync-v2 design validated.

`git diff --check` passed with no output.

## 9. Build output summary

No build was run locally because this change only adds remote CI
configuration. The remote CircleCI run is the build validation surface for this
ticket.

## 10. Remaining risks

CircleCI macOS jobs require the account/project to have access to the
configured macOS resource class and sufficient credits. If CircleCI rejects the
macOS executor or resource class, that is an external CI entitlement blocker,
not a repository syntax failure.

This ticket does not replace the GitHub billing issue or authorize direct
pushes to `main`, tag mutation, branch cleanup, backup creation, mirrors,
history rewrite, force-push, `/goal` clearing, or goal completion.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Branch-local CircleCI config exists | PASS | `.circleci/config.yml` added |
| CircleCI config parses as YAML | PASS | YAML parse command listed expected jobs |
| CircleCI config includes validate, secret scan, e2e core, and mac ARM jobs | PASS | `validate,secret-scan,e2e-core,mac-arm-build` |
| Existing CI contract validator remains green | PASS | `bun run validate:ci-contract` passed |
| No secrets are committed | PASS | Config contains no tokens or credentials |
