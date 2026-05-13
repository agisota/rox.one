# v1.0.0 Release Candidate — Pre-flight Validation Checklist

Owner gate: M.20 (RC validation). This document is the canonical pre-flight
checklist the release operator walks before tagging `v1.0.0-rc.1`. The 72-hour
soak protocol that follows tagging lives in
`docs/release/v1-rc-72h-soak-protocol.md`.

Every item carries:

- **Owner** — `operator` (manual), `CI` (workflow), or `agent` (delegated run).
- **Duration** — expected wall-clock.

A pre-flight pass requires every item green. One red item blocks the tag.

## 1. Validator gates (CI)

Each entry below is a `package.json` script name quoted verbatim. Run order is
top-down; an early red short-circuits the rest.

| Validator | Owner | Duration |
| --- | --- | --- |
| `bun run validate:rebrand` | CI | 5s |
| `bun run validate:agent-contract` | CI | 10s |
| `bun run validate:roadmap` | CI | 5s |
| `bun run validate:ci-contract` | CI | 10s |
| `bun run validate:e2e-core-scenarios` | CI | 30s |
| `bun run validate:mac-private-release-boundary` | CI | 15s |
| `bun run validate:bundle-budget` | CI | 5s |
| `bun run validate:bundle-policy` | CI | 10s |
| `bun run validate:packaged-artifacts` | CI | 20s |
| `bun run validate:private-release-pipeline` | CI | 10s |
| `bun run validate:architecture-docs` | CI | 5s |
| `bun run validate:sync-v2-design` | CI | 5s |
| `bun run validate:mac-arm-build-workflow` | CI | 10s |
| `bun run validate:mac-boundary-fixtures` | CI | 5s |
| `bun run validate:audit` | CI | 60s |
| `bun run validate:docs` | CI | 30s |

Aggregate gate: `bun run validate:ci` must exit 0 on the tag candidate SHA.

## 2. Automated test suites (CI)

| Suite | Command | Owner | Duration |
| --- | --- | --- | --- |
| Unit (bun:test) | `bun run test:units` | CI | 5 min |
| Renderer (RTL/vitest) | `bun run test:rtl` | CI | 8 min |
| Shared package matrix | `bun run test:shared:all` | CI | 90s |
| Doc-tool smokes | `bun run test:doc-tools` | CI | 60s |
| i18n parity / sort / coverage | `bun run lint:i18n:parity && bun run lint:i18n:sorted && bun run lint:i18n:coverage` | CI | 30s |
| Typecheck (workspace) | `bun run typecheck:all` | CI | 90s |
| E2E core scenarios | full E2E suite if `bun run e2e:core` exists, else manual §4 walk | CI / operator | 20 min |

Aggregate gate: `bun run validate:release` exits 0 on a clean checkout.

## 3. Build + supply-chain (CI)

| Item | Command | Owner | Duration |
| --- | --- | --- | --- |
| Electron build (all platforms) | `bun run electron:build` | CI | 4 min |
| Signed-build workflow dry-run | trigger `mac-arm-build` workflow, abort before notarization | operator | 10 min |
| SBOM generation | CycloneDX SBOM emitted into release artifacts | CI | 60s |
| Secret-leak scan | `trufflehog` and `gitleaks` clean on the tag SHA | CI | 90s |
| Dependency-pin audit | `bun.lockb` unchanged versus the previous main SHA except where a `chore(deps)` PR was merged | operator | 5 min |

## 4. Manual surface walks (operator)

Each Pillar 4 composer surface and each governance surface is walked once on
the packaged build. Operator records pass/fail in the soak evidence doc.

| Surface | Steps | Owner | Duration |
| --- | --- | --- | --- |
| Composer history recall | type 3 messages, send each, recall via up-arrow | operator | 2 min |
| Composer emphasis | bold/italic toggles round-trip; persist across reload | operator | 2 min |
| Composer line-numbers | line-number gutter toggles; survives session change | operator | 2 min |
| Composer paste-image | paste PNG from clipboard; thumbnail renders; submit succeeds | operator | 2 min |
| Composer voice-slot | voice-input slot opt-in; mic permission flow; transcript lands | operator | 3 min |
| RBAC admin UI | open admin panel, change role on test user, save, reload | operator | 3 min |
| Team management view | invite member, accept invite, remove member | operator | 5 min |
| Audit-log surface | open audit log, filter by event type, export CSV | operator | 3 min |

## 5. Ticket-status hygiene (agent)

A `release-validator` skill run reports the following counts before the tag:

- **P0 / P1 open issues**: must be `0`. A non-zero count blocks the tag.
- **M.13 security tickets**: all `Status: DONE` with matching worklogs.
- **R.0 through R.10 rebrand sweep tickets**: all `Status: DONE`.
- **M.20 own ticket (T298 family)**: this checklist's owning ticket
  (`T298-rc-preflight`) flipped to `Status: DONE` and its worklog merged.

Source of truth: `docs/tickets/*.md` `Status:` lines + `.swarm/master-roadmap-log.md`.

## 6. Tag-time evidence (operator)

Before `git tag v1.0.0-rc.1`:

1. Open `docs/release/v1-rc-evidence-<DATE>.md`; record every command from
   §1-§3 with its exit code and runtime.
2. Append the §4 surface-walk results with screenshots for any red.
3. Append the §5 release-validator report verbatim.
4. Commit the evidence doc on the same SHA the tag will point to. The
   evidence-doc commit is the immediate parent of the tag.

The 72-hour soak begins the moment the tag is pushed. Soak rules and
rollback procedure live in `docs/release/v1-rc-72h-soak-protocol.md`.
