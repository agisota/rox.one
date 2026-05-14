# T476 - CircleCI gate failure repairs

Status: DONE

## Context

CircleCI validation for PR #217 and stacked PR #218 reached real job steps and
exposed environment-sensitive failures: Bun 1.3.10 did not honor the current
`bunfig.toml` test ignore contract, the first CircleCI secret scan scanned
full history and hit known test fixtures, Electron startup could self-copy the
canonical `~/.rox` directory on macOS, and electron-builder schema validation
rejected stale Windows/Linux config keys during the mac ARM package job.

## Goal

Repair the CI surfaces without weakening the repository's local validation
contracts or committing secrets.

## Required UI

None.

## Required Data/API

No API or persisted data changes.

## Required Automations

- Keep CircleCI on the Bun version validated locally for default `bun test`.
- Scope CircleCI Gitleaks to changed files for PR validation.
- Preserve the mac ARM package validation path by making the builder config
  schema-valid.

## Required Subagents

None.

## TDD Requirements

- Add a regression for the user-data migration self-copy case before changing
  the migration guard.
- Validate CI config parsing and the affected static gates.

## Implementation Requirements

- Do not commit secrets.
- Do not disable the named validation jobs.
- Keep the default CircleCI `build` job as a compatibility trigger.

## Validation Commands

- `bun test packages/shared/src/config/__tests__/user-data-migration.test.ts`
- `bun -e "import fs from 'node:fs'; import yaml from 'js-yaml'; const cfg = yaml.load(fs.readFileSync('.circleci/config.yml','utf8')); if (!cfg?.jobs?.build || !cfg?.jobs?.validate || !cfg?.jobs?.['secret-scan']) throw new Error('invalid CircleCI config shape'); console.log(Object.keys(cfg.jobs).join(','));"`
- `git diff --check`
- `bun run validate:docs`
- `bun run validate:ci-contract`
- `bun run validate:linux-deb-rpm`
- `bun run validate:windows-private-release-boundary`
- `bun run validate:mac-arm-build-workflow`

## Acceptance Criteria

- [x] CircleCI uses Bun 1.3.13.
- [x] CircleCI default `build` trigger stays lightweight and greenable.
- [x] CircleCI secret scan checks changed files instead of the full historical
  fixture corpus.
- [x] User-data migration no longer copies a directory onto itself when
  canonical `~/.rox` is the only discovered source.
- [x] electron-builder config is schema-compatible for mac ARM package
  validation.
