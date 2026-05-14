# T475 - CircleCI validation bridge

Status: DONE

## Context

GitHub Actions checks for PR #217 and the stacked PR #218 cannot start while
the GitHub account is locked by the billing issue. CircleCI already has the
repository registered, but the only existing CircleCI branch contains the
generated sample workflow, not the repository validation gates.

## Goal

Add a CircleCI configuration that can run the blocked validation surface from
CircleCI while GitHub Actions is unavailable.

## Required UI

None.

## Required Data/API

Use CircleCI only for CI execution. Do not commit API tokens, personal access
tokens, or environment-specific secrets.

## Required Automations

- Add CircleCI jobs for the validation, secret scan, e2e core, and mac ARM
  packaging gates that are currently blocked in GitHub Actions.
- Keep the commands aligned with the existing GitHub workflow scripts.

## Required Subagents

None.

## TDD Requirements

- Confirm the target branch has no CircleCI config before adding one.
- Validate the new YAML parses and keeps the existing CI contract green.

## Implementation Requirements

- Add only CI configuration and task evidence.
- Do not change production runtime behavior.
- Do not perform destructive R.11 operations.

## Validation Commands

- `git show HEAD:.circleci/config.yml`
- `bun -e "import fs from 'node:fs'; import yaml from 'js-yaml'; const cfg = yaml.load(fs.readFileSync('.circleci/config.yml','utf8')); if (!cfg?.jobs?.validate || !cfg?.workflows?.ci) throw new Error('invalid CircleCI config shape'); console.log(Object.keys(cfg.jobs).join(','));"`
- `git diff --check`
- `bun run validate:ci-contract`

## Acceptance Criteria

- [x] Branch-local CircleCI config exists.
- [x] CircleCI config parses as YAML.
- [x] CircleCI config includes validate, secret scan, e2e core, and mac ARM
  jobs.
- [x] Existing CI contract validator remains green.
- [x] No secrets are committed.
