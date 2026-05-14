# M.3 — Upstream `v0.9.3` Merge Readiness Audit

**Date:** 2026-05-14
**Author:** Architecture lane (M.3 prep)
**Spine phase:** M.3 — Upstream merge to `v0.9.3`
**Closeout ticket:** T304 (M.3 prep audit; see `docs/tickets/T304-m3-upstream-audit.md`)
**Status:** Decision-grade pre-merge surface map. **Does not execute the merge.**
**Companion runbook:** `docs/release/m3-merge-runbook.md`

---

## 1. Scope

This audit prepares the operator for Phase M.3 of the spine — the upstream
merge of `v0.9.3` from `rox-ai-agents/rox-agents-oss` into the
post-rebrand local tree. It is **documentation only**. No source files are
modified by the audit itself; the audit's job is to surface every place the
merge will touch a ROX-owned identifier, env-var, or contract that the
rebrand sweep has already canonicalised.

The merge itself is executed in a follow-up ticket cluster (T230 / T231 /
T232 per the master-roadmap goal, conditional on those slots being free at
merge time — see §10) on branch `chore/upstream-v0.9.3-rox-merge`.

## 2. Upstream metadata

| Field | Value |
| --- | --- |
| Upstream repo | `https://github.com/rox-ai-agents/rox-agents-oss.git` |
| Upstream tag | `v0.9.3` (2026-05-11) |
| Last upstream tag merged locally | `v0.9.1` (per `docs/release/upstream-v0.9.1-rox-protected-map.md`) |
| Local base reference | `v0.8.12` (still the local-tree historical merge base; see `plan.md §6.1`) |
| Local `package.json.version` | `0.9.2` (already bumped past last merged upstream tag) |
| Local legal-preserve attribution URL | `https://github.com/lukilabs/rox-agents-oss` (README §License; immutable until R.11) |
| Last upstream release-notes file shipped locally | `apps/electron/resources/release-notes/0.9.1.md` |

The upstream organisation was renamed `lukilabs` → `craft-ai-agents` and the
repo renamed `rox-agents-oss` → `rox-ones-oss` between v0.9.1 and v0.9.3.
The legal-preserve attribution URL (`lukilabs/rox-agents-oss` in README,
NOTICE, TRADEMARK, Dockerfile) reflects the post-rename form per Apache 2.0
§4. Adding a new remote is mandatory; the existing `upstream` remote pointed
at the old org and has not yet been re-pointed.

```bash
git remote add upstream https://github.com/rox-ai-agents/rox-agents-oss.git \
  || git remote set-url upstream https://github.com/rox-ai-agents/rox-agents-oss.git
git fetch upstream --tags
```

## 3. Why M.3 is the second-largest single block

Every `ROX_*` env-var, `@rox-one/*` import, `CraftAgent*` identifier,
`rox-cli` binary name, and `~/.rox/` path that upstream re-introduces in
`v0.9.3` must be re-rebranded against the canonical ROX tokens locked in
ADR 0011 and enforced by `bun run validate:rebrand`. The R.5 / R.6 / R.7
sweeps already migrated the local tree exhaustively; M.3 is the only phase
in the spine where forbidden upstream tokens can re-enter `main`.

The spine concurrency rule §4 (M.3 strictly after R.5–R.7) exists to ensure
the rebrand allowlist is canonical before the merge runs. As of
2026-05-14 `validate:rebrand` is in `package.json` and R.5–R.7 closed under
T273–T291. The merge can proceed once M.3 prep (this audit + the runbook)
is on `main`.

## 4. Conflict surfaces categorised by lane

The audit groups expected conflict surfaces into four lanes. Conflict
volume is estimated from the v0.9.1 protected map (`docs/release/
upstream-v0.9.1-rox-protected-map.md`) extrapolated by the two-minor-bump
delta between v0.9.1 and v0.9.3 plus the post-R.0 rebrand cleanup.

### 4.1 RBAC lane (highest re-application cost)

| Surface | Files touched (estimate) | ROX canonical pattern |
| --- | ---: | --- |
| `packages/shared/src/auth/` | 8–14 | Preserve ROX `Permission`, `Role`, `Policy` types from M.2. |
| `packages/server-core/src/handlers/rpc/permissions.ts` | 1 | Preserve `permittedWorkspaces` session field plumbing (M.2 T223–T229). |
| `packages/server-core/src/sessions/SessionManager.ts` | 1 | Preserve session storage interface; reject any upstream `CraftSessionManager` rename. |
| ADR `0007-multi-tenant-storage-isolation.md` | 0 (immutable) | Untouched — legal-preserve historical. |

**Re-apply pattern:** rename every upstream `CraftPermission`, `craft-rbac`,
`ROX_RBAC_*` token to its `Rox*` / `rox-rbac` / `ROX_RBAC_*` equivalent
before the merge commit lands. The merge must keep ROX's slice-6
session-permission propagation (M.2) intact. **Trust boundary:** RBAC
decisions must continue to be made server-side; never accept an upstream
patch that pushes the decision into the renderer.

### 4.2 Experience-layer lane (highest behavioural risk)

| Surface | Files touched (estimate) | ROX canonical pattern |
| --- | ---: | --- |
| `packages/shared/src/workbench/` | 0 expected | ROX-owned; reject any upstream change wholesale per `plan.md §6.2`. |
| `apps/electron/src/renderer/components/workbench/` | 0 expected | ROX-owned; reject upstream wholesale. |
| `packages/shared/src/i18n/locales/` (en, ru, de, es, hu, ja, pl, zh-Hans) | 7–8 | Merge upstream key additions; preserve ROX-specific keys (Composer, Spec Builder, RBAC strings); preserve Russian locale (ROX-owned). |
| `packages/shared/src/sources/credential-manager.ts` | 1 | Preserve `RoxOAuth` after R.2 rename; reject upstream `RoxOAuth` rename. |

**Re-apply pattern:** for every i18n key added upstream, copy the EN value
verbatim; for every key removed upstream that ROX still uses, **keep ROX's
definition** (Composer/Spec Builder/RBAC keys are ROX-owned). Run
`bun run lint:i18n:parity` immediately after the merge to surface any
asymmetry between the eight locales.

### 4.3 UI lane (icon and surface-text drift)

| Surface | Files touched (estimate) | ROX canonical pattern |
| --- | ---: | --- |
| `apps/electron/src/renderer/components/icons/RoxAppIcon.tsx` (and `RoxAgentsLogo`, `RoxAgentsSymbol`) | 3 | Preserve ROX-renamed component names; reject upstream `RoxAgentsLogo` revival. |
| `apps/electron/index.html` (title, meta) | 1 | `<title>ROX.ONE</title>` + `application-name=ROX.ONE` (R.1 baseline). |
| `apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx`, `MessagingSettingsPage.tsx` | 2 | Merge upstream behavioural changes; reject any settings strings carrying `ROX.ONE` literals. |
| Playground demos (`apps/electron/src/renderer/playground/demos/messaging/*.tsx`) | 2–3 | Preserve `"ROX.ONE"` literals; reject upstream `"ROX.ONE"` revival. |

**Re-apply pattern:** treat every Rox-prefixed React component and every
HTML title/meta string as **ROX-owned** and reject any upstream content
that resurrects the upstream brand. Net-new upstream icons (if any) land
under the ROX namespace.

### 4.4 Config / env / packaging lane (mechanical but high-volume)

| Surface | Files touched (estimate) | ROX canonical pattern |
| --- | ---: | --- |
| `package.json` (root) | 1 | Preserve the eight ROX `validate:*` scripts; merge dependency bumps; do **not** revert `name: rox-agent` (note: still legacy; closeout in R.10/R.11). |
| `bun.lock` | 1 | Regenerate with `bun install` after dependency conflicts resolve. |
| Every workspace `package.json` (`packages/*/package.json`, `apps/*/package.json`) | 12 | Preserve `@rox-one/*` scope; reject any upstream `@rox-one/*` revival. |
| `Dockerfile.server` | 1 | Preserve `org.opencontainers.image.source` legal-preserve label; merge build-step changes. |
| `.github/workflows/validate.yml`, `validate-server.yml` | 2 | Preserve ROX validation jobs (`validate:rebrand`, `validate:agent-contract`, `validate:roadmap`); merge upstream matrix bumps. |
| Env-var sites consuming `ROX_*` via `readEnv()` shim (R.6) | ~100 | Reject any upstream patch that bypasses the shim; **all** new env reads must route through `readEnv()`. |
| User-data path `~/.rox/` (R.8 migration shim) | source: `packages/shared/src/config/paths.ts` | Reject any upstream `~/.rox/` patch that bypasses the migration shim. |

**Re-apply pattern (env-vars):** for every `ROX_*` env-var upstream
introduces, write a one-line `readEnv()` mapping in
`packages/shared/src/config/env-shim.ts` (the R.6 surface) that translates
`ROX_FOO` → `ROX_FOO` with the deprecation warning. Document the new
mapping in `docs/release/rebrand-mapping-2026-05-13.md` as a follow-up
edit (legal-preserve allowlist exemption: that file is the canonical
rebrand inventory).

## 5. High-risk merge surfaces

These five surfaces fail closed and require explicit operator review
**before** the merge commit is created — not after.

| # | Surface | Risk | Required gate |
| ---: | --- | --- | --- |
| 1 | **Storage scope (multi-tenant isolation)** | Upstream might introduce a new shared mutable store that breaks ADR 0007's per-tenant isolation. | `bun test packages/shared/src/config/__tests__/storage-*` must stay green. **Reject** any patch that flattens tenant scope. |
| 2 | **RBAC policy enforcement** | Upstream might bypass `permittedWorkspaces` (M.2 slice 6). | `bun test packages/shared/src/auth/__tests__/` must stay green. Server-side decision boundary is non-negotiable. |
| 3 | **Audit event surface (M.14 substrate)** | Upstream might emit audit events through a non-canonical channel that bypasses the M.1.5 queryable backend. | `bun run validate:audit` must stay green. New event types route through `packages/audit/`. |
| 4 | **Mac trust boundary** (M.18) | Upstream might ship an unsigned binary or weaken the entitlement set. | `bun run validate:mac-private-release-boundary` must stay green. **Reject** any entitlement change without a paired ADR. |
| 5 | **Windows / Linux trust boundary** | Symmetric to Mac; upstream might land code-signing changes that conflict with the private release pipeline. | `bun run validate:windows-private-release-boundary` + `bun run validate:private-release-pipeline` must stay green. |

The five gates above are blocking. If any of them regresses post-merge,
abort the merge per the runbook's failure-recovery section.

## 6. Recommended pre-merge backup commands

Run **all** four before invoking `git merge`. They form the two-pass
backup pattern referenced by R.11's force-push protocol — backups are
mandatory whenever a merge touches more than ten files.

```bash
# 1. Tag the pre-merge state for fast rollback.
git tag -a pre-m3-upstream-v0.9.3 -m "Pre-M.3 upstream v0.9.3 merge backup" main
git push origin pre-m3-upstream-v0.9.3

# 2. Push the current main HEAD as a backup branch (network mirror).
git push origin main:backup/pre-m3-$(date -u +%Y%m%d-%H%M%S)

# 3. Stash any uncommitted work (defensive; main should be clean).
git stash push -u -m "pre-m3-merge-defensive-stash"

# 4. Snapshot the rebrand inventory baseline (for post-merge diff).
git ls-files -z \
  | xargs -0 rg -c -F -e '@rox-one/' -e 'ROX_' -e 'rox-cli' -e 'RoxAppIcon' \
  > /tmp/.rox-inventory.pre-m3.txt  # NOTE: /tmp use FORBIDDEN by ticket rules — write under .omc/state/ instead at execution time
```

The /tmp note above is deliberate: the audit documents the *intended*
inventory snapshot, but the runbook (§4) re-writes the target path to
`.omc/state/rox-inventory.pre-m3.txt` to honour the operator's rule
forbidding `/tmp` writes during the merge.

## 7. Validation matrix (must pass before claiming M.3 green)

| Gate | Owner phase | Command |
| --- | --- | --- |
| Rebrand inventory | R.0 / R.10 | `bun run validate:rebrand` |
| Roadmap coherence | T299 (spine) | `bun run validate:roadmap` |
| Agent contract | M.0 | `bun run validate:agent-contract` |
| Architecture docs | M.0 | `bun run validate:architecture-docs` |
| Multi-tenant storage isolation | C.4 / M.1.5 | `bun test packages/shared/src/config/__tests__/storage-*` |
| RBAC slice 6 | M.2 | `bun test packages/shared/src/auth/__tests__/` |
| Audit pipeline | M.1.5 / M.14 | `bun run validate:audit` |
| Mac private release | M.18 | `bun run validate:mac-private-release-boundary` |
| Windows private release | M.18 | `bun run validate:windows-private-release-boundary` |
| Private release pipeline | M.17 | `bun run validate:private-release-pipeline` |
| Bundle policy | M.16 | `bun run validate:bundle-policy` |
| i18n parity | R.1 / M.0 | `bun run lint:i18n:parity` |
| Full unit suite | every phase | `bun test` |
| Type check | every phase | `bun run typecheck:all` |
| Electron build smoke | M.18 / M.19 | `bun run electron:build` |
| Diff hygiene | every phase | `git diff --check` |

## 8. Re-apply pattern reference card

When a conflict surfaces in the merge, consult this table for the canonical
ROX-side replacement.

| Upstream token | ROX canonical (post-R.0–R.10) | Source ADR / phase |
| --- | --- | --- |
| `ROX_*` (env-var prefix) | `ROX_*` (route through `readEnv()` shim) | ADR 0011 + R.6 |
| `rox-one` (package scope segment) | `rox-one` | ADR 0011 + R.5 |
| `@rox-one/*` (npm scope) | `@rox-one/*` | ADR 0011 + R.5 |
| `CraftAgent*` (TS identifiers) | `RoxAgent*` (backward-compat alias kept where re-exported) | ADR 0011 + R.2 |
| `RoxAppIcon`, `RoxAgentsLogo`, `RoxAgentsSymbol` | `RoxAppIcon`, `RoxAgentsLogo`, `RoxAgentsSymbol` | R.2 |
| `RoxMcpClient`, `RoxOAuth`, `RoxMetadataSchema` | `RoxMcpClient`, `RoxOAuth`, `RoxMetadataSchema` | R.2 |
| `rox-cli` (binary name) | `rox-cli` | R.3 |
| `rox-logos/` (asset dir) | `rox-logos/` | R.3 |
| `~/.rox/`, `~/.rox/` (user-data path) | `~/.rox/` (migration shim handles legacy `~/.rox-agent/`) | R.8 |
| `ROX.ONE`, `ROX.ONE` (product text) | `ROX.ONE` (wordmark) or `Agent Workbench Suite` (suite descriptor) | ADR 0011 + R.1 |
| `docs.craft.do` (community URL) | per R.9 community-link audit closeout | R.9 |

Backward-compat alias rule: a removed top-level export keeps a one-version
deprecation alias only when external scripts consume it. The two
high-fan-in re-export packages are `@rox-one/shared` and
`@rox-one/server-core` (per the rebrand sweep §R.5).

## 9. Legal-preserve allowlist (must not be edited by the merge)

Per Apache 2.0 §4 and ADR 0011:

```
LICENSE
NOTICE
TRADEMARK.md
Dockerfile.server                       # org.opencontainers.image.source label only
README.md                               # the "License" + "Acknowledgements" sections only
docs/decision-records/                  # historical ADRs reference original names
docs/worklog/T0*-*.md                   # historical worklogs immutable
docs/tickets/T0*-*.md                   # historical tickets immutable
docs/worklog/T1*-*.md                   # historical DONE worklogs immutable
docs/tickets/T1*-*.md                   # historical DONE tickets immutable
docs/worklog/T2*-*.md                   # historical or completed rebrand worklogs immutable once DONE
docs/tickets/T2*-*.md                   # historical or completed rebrand tickets immutable once DONE
apps/electron/resources/release-notes/  # historical release notes immutable (incl. 0.9.1.md)
.brv/                                   # ByteRover state immutable
.swarm/                                 # historical swarm state
.git/                                   # never touched
```

Three byte-diffs must run after the merge resolves to assert these files
were not silently rewritten:

```bash
git diff main -- LICENSE NOTICE TRADEMARK.md Dockerfile.server
# expected: only Dockerfile.server build-step lines may change; the
# org.opencontainers.image.source label must be byte-identical.
```

## 10. Ticket cluster status

The master-roadmap goal allocates T230 / T231 / T232 to the M.3 merge.
**Current state (2026-05-14):** T230 has been repurposed to
`T230-rbac-adr` (M.2 closeout) and T232 to `T232-audit-log-surface`. T231
is unallocated. The M.3 execution ticket cluster therefore needs to be
**re-numbered** before the merge runs.

Recommended re-allocation (subject to operator approval):

- `T231-upstream-v0.9.3-merge-implementation` — first FREE slot in the
  reserved range matching the original spine intent.
- Two adjacent slots for `merge-plan` and `merge-evidence-log` — pick
  from spine-reserved `T306-T320` if T231 is taken at merge time.

Document the chosen numbers in the M.3 execution ticket's header and in
`.swarm/master-roadmap-log.md` upon closeout.

## 11. Glossary

- **Re-apply pattern** — the canonical ROX-side replacement for an
  upstream token, derived from ADR 0011 + the R.0–R.10 inventory.
- **Legal-preserve** — files whose content must remain byte-identical to
  the upstream attribution form per Apache 2.0 §4.
- **Fail closed** — a validation gate that returns non-zero immediately
  on regression rather than emitting a warning.
- **Two-pass backup** — a tag + a network-pushed backup branch, both
  created before the destructive operation begins.
