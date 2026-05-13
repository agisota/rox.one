# T256 worklog — Private CI/CD release pipeline hardening

## 1. Goal

Harden the private RC pipeline so it is manual-dispatch only,
tag-protected, validates rebrand + agent-contract + release +
mac-trust-boundary BEFORE build, and ships SHA-256-checksummed
installer artifacts.

## 2. Surfaces inspected

- `.github/workflows/private-release.yml`
- `scripts/validate-private-release-pipeline.ts`
- `apps/electron/electron-builder.yml`
- `package.json` validate:* + electron:build scripts
- `scripts/validate-mac-private-release-boundary.ts` (M.18 validator
  consumed by the new pre-build gate)

## 3. Gap analysis (preserved in audit doc)

| # | Gap | Action |
| - | --- | ------ |
| 1 | PR + push triggers fire on every PR/main | Dropped both; workflow_dispatch only |
| 2 | No tag-pattern guard | Pre-flight rejects refs not matching `^v\d+\.\d+\.\d+(-rc\.\d+)?$` |
| 3 | Rebrand + agent-contract not asserted pre-build | Pre-build gate runs both |
| 4 | M.18 mac-trust-boundary not in CI | Pre-build gate also runs it |
| 5 | `validate:release` not enforced in workflow | Pre-build gate runs it explicitly |
| 6 | Installer paths not uploaded | New `release-artifacts` upload |
| 7 | No checksum manifest | New step writes `release-checksums.txt` (SHA-256) |
| 8 | Validator did not assert 1-7 | Validator extended with shape + ordering + injection guard |

## 4. Changes

- **Workflow** (+93/-16): drop PR/push triggers; add tag-pattern
  guard (uses `INPUT_TAG` env to avoid command injection); add
  pre-build validation gate; add checksum computation step; add
  `release-artifacts` and `release-checksums` upload actions.
- **Validator** (+87/-15): assert manual-dispatch only, forbid
  `pull_request:` / `push:`, assert tag-pattern regex, ordering
  (tag-guard < install, pre-build gate < build), checksum + upload
  step names, audit-doc anchors.
- **Audit doc** (NEW, 41 LOC): stage map, 8-row gap table,
  acceptance, T257 follow-ups.
- **Ticket + worklog** (this file + sibling): `Status: DONE`.

## 5. Validation runs

| Command | Result |
| --- | --- |
| `bun run validate:private-release-pipeline` | pass (idempotent — same stdout twice) |
| `bun run validate:rebrand` | pass |
| `bun run validate:agent-contract` | pass (256 tickets incl. T256 DONE) |
| `bun run validate:roadmap` | pass (46 phases, 111 tickets) |
| `bun run validate:ci-contract` | pass |
| `bun run validate:mac-private-release-boundary` | pass (non-darwin) |

## 6. Idempotency

`validate:private-release-pipeline` produces byte-identical stdout
across consecutive runs against the same SHA.

## 7. Notes / deviations

- Task mentioned `.cjs` variant; the repo ships the `.ts` validator.
  We extended the `.ts` in place rather than introducing a shim.
- `validate:release` is invoked from the pre-build gate AND already
  contains `electron:build`. The workflow keeps a later explicit
  `bun run electron:build` step so the upload action picks up
  fresh artifacts; T257 can de-dupe once provenance lands.
- macOS minutes per dispatch drops from "every PR + every push" to
  "every operator-initiated tag dispatch".
