# Codex `/goal` — ROX ONE Rebrand Sweep

**Date:** 2026-05-13
**Author:** Branding lane
**Sibling of:** `2026-05-13-agent-workbench-suite-master-roadmap-goal.md`
**Slot:** between master-roadmap Phase 1 (C.4 follow-ons closeout) and Phase 2 (RBAC slice) — inserts as **Phase 1.7**
**Audience:** Codex CLI in autonomous `/goal` mode (or human operator)

## Mega-Objective

Drive a **comprehensive, sweep-style rebrand** of the entire `rox-one-terminal` repository so that:

1. Every user-visible and developer-visible reference to **"Craft" / "craft-agent" / "Craft Agents"** as a product is replaced with the canonical **ROX.ONE** / **Agent Workbench Suite** branding.
2. No third-party "community" link (Discord, forum, social, docs site) belonging to upstream remains pointing outside ROX.ONE.
3. All required upstream attribution under Apache 2.0 §4 (`LICENSE`, `NOTICE`, `TRADEMARK.md`, the `https://github.com/lukilabs/craft-agents-oss` source-URL labels in `Dockerfile.server`) is **preserved exactly** — the rebrand renames the *product*, not the *attribution*.
4. Existing single-user installs continue to work after upgrade — config-dir, env-var, and credential-store migrations are shimmed, not break-changed.
5. A final grep gate (`rg -i 'craft' <repo>` outside the legal-preserve allowlist) returns **zero** matches.

This goal is **inserted between master-roadmap Phase 1 (C.4 follow-ons closeout) and Phase 2 (RBAC)**. It does *not* run in parallel with C.4 work because Phase R.5 (package scope rename) touches the same import graph that C.4 Phase 1.x is actively modifying. Wait for `T222-c4-followups-closeout` to be `Status: DONE` before invoking this `/goal`.

## Read first (once, before Phase R.0)

1. `AGENTS.md` — operating contract (TDD loop, ticket+worklog discipline, 11-section worklog, Lore commit protocol).
2. `plan.md` §1 (Target Definition) — the canonical product description and North Star (VDI).
3. `LICENSE`, `NOTICE`, `TRADEMARK.md` — the legal-preserve boundary. Read these in full.
4. `packages/shared/src/branding.ts` — the existing brand-config surface. New brand tokens live here.
5. `README.md` — already partially rebranded; serves as the canonical user-facing brand reference.
6. `docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md` — confirms this goal slots as Phase 1.7.
7. The **rebrand mapping report** committed alongside this goal: `docs/release/rebrand-mapping-2026-05-13.md` (created in Phase R.0).

## Discipline (inherited from `AGENTS.md`, applies to every phase)

- One ticket per logical change in `docs/tickets/<TASK>.md` (next free slot: T260+).
- One worklog per ticket in `docs/worklog/<TASK>.md` following the **11-section format**.
- **TDD-first** even for refactors: every rename ticket adds a grep-based regression test (e.g. `expect grep -r 'CraftAppIcon' src to find zero matches`) before claiming green.
- Atomic Lore-style commits; one ticket = one commit.
- **No direct `main` pushes.** Each phase opens a feature branch named `chore/rebrand-R<n>-<slug>` and merges via PR after the phase's stopping condition is green.
- Run the global validation matrix below before every PR open.

## Global validation matrix (run before claiming any phase green)

- `bun test <impacted test files>`
- `bun run typecheck`
- `bun run lint`
- `bun test` (full suite) when the phase changes runtime code; doc-only phases skip the full suite
- `bun run build` when the phase changes source/runtime behavior
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `git diff --check`
- A **rebrand-specific lint script** (added in Phase R.0): `bun run validate:rebrand` — greps the repo for forbidden tokens and fails if any are found outside the legal-preserve allowlist.

## Step zero (do this once before Phase R.0)

```bash
git -C . switch main
git -C . pull --ff-only origin main
```

Verify the master roadmap's Phase 1 closeout is complete:

```bash
git -C . log --oneline | grep -E "T222-c4-followups-closeout|Phase 1 closeout" || \
  echo "BLOCKED: C.4 follow-ons not yet closed. STOP and wait for master roadmap Phase 1."
```

If the closeout marker is missing, **stop and report**. Do not start Phase R.0 while codex is still landing C.4 follow-on commits — package-scope renames in Phase R.5 will collide with active import-path changes.

---

# Phase R.0 — Canonical brand decision + rebrand inventory

The whole sweep depends on three locked decisions. Encode them in a single ADR before any rename begins.

### Locked decisions to record

1. **Canonical product brand token.** One of: `ROX.ONE` (preferred — already the dominant token in `branding.ts` and the marketing site), `ROX ONE`, `ROX_ONE`, or `Agent Workbench Suite`. The default below is **`ROX.ONE`** as the product name with **`Agent Workbench Suite`** as the suite descriptor (per `plan.md §1`).
2. **Package scope.** One of: `@rox-one/*` (kebab-case, npm-conventional), `@roxone/*` (flat), `@rox/*` (short). The default below is **`@rox-one/*`**.
3. **Env-var prefix policy.** `ROX_*` for all new vars; legacy `CRAFT_*` names continue to be read for **one minor version** with a deprecation warning, then dropped. Migration shims are *mandatory*, not optional.

### New ticket cluster

- `T260-rebrand-canonical-decision-adr` — writes ADR `0011-rox-one-rebrand-canonical-tokens.md` capturing the three decisions above plus the legal-preserve allowlist.
- `T261-rebrand-mapping-report` — generates `docs/release/rebrand-mapping-2026-05-13.md` (the post-sweep audit baseline) by running structured `ripgrep` over every bucket from the rebrand-mapping survey already in this repo's history.
- `T262-rebrand-lint-script` — adds `scripts/validate-rebrand.cjs` and wires it as `bun run validate:rebrand` in root `package.json`. The script greps for the forbidden-token list and the legal-preserve allowlist; exits non-zero if any forbidden token appears outside the allowlist.

### Forbidden-token list (denied unless allowlisted)

```
craft-agent
@craft-agent
CRAFT_              (env-var prefix at line start, except the deprecation-shim definitions)
~/.craft
.craft-agent
Craft Agents
Craft Agent
CraftAppIcon
CraftAgentsLogo
CraftAgentsSymbol
CraftMcpClient
CraftOAuth
CraftMetadataSchema
craft-cli
craft-logos
```

### Legal-preserve allowlist (these may keep the legacy names)

```
LICENSE
NOTICE
TRADEMARK.md
Dockerfile.server                       # org.opencontainers.image.source label only
README.md                               # the "License" + "Acknowledgements" sections only
docs/decision-records/                  # historical ADRs reference original names
docs/worklog/T0*-*.md                   # historical worklogs are immutable
docs/tickets/T0*-*.md                   # historical tickets are immutable
apps/electron/resources/release-notes/  # historical release notes are immutable
plan.md                                 # historical plan; may be revised in Phase R.4
snapshot.md                             # historical snapshot; may be revised in Phase R.4
.brv/                                   # ByteRover state; immutable
.swarm/                                 # historical swarm state
.git/                                   # never touched
```

### Validation

- `bun run validate:rebrand` must exist and exit with non-zero on the current main (proving the gate works).
- ADR 0011 exists and links to the rebrand-mapping report.

### Stopping condition

- ADR 0011 committed.
- `docs/release/rebrand-mapping-2026-05-13.md` committed.
- `scripts/validate-rebrand.cjs` committed and wired into `package.json` scripts.
- T260, T261, T262 all `Status: DONE`.

---

# Phase R.1 — Surface text completion

### Goal

Finish the 5% of user-visible rebrand that still ships old tokens.

### Files and changes

1. **i18n locale keys** in `packages/shared/src/i18n/locales/en.json` and `ru.json`:
   - `menu.craftMenu` → rename key to `menu.appMenu` (update all consumers).
   - `onboarding.apiSetup.craftAgentsBackend` → rename key to `onboarding.apiSetup.roxBackend` (update consumers).
   - Audit every value string for `Craft Agents` / `Craft Agent` literal mentions; rewrite to `ROX.ONE` or `Agent Workbench Suite` per context.
2. **README.md** — replace any remaining `Craft Agents` body text with `ROX.ONE`. Keep the "Acknowledgements" / "License" section's upstream attribution intact (this is legal-preserve).
3. **`apps/electron/resources/docs/automations.md`** — replace `~/.craft-agent/logs/messaging-gateway.log` with `~/.rox/logs/messaging-gateway.log`.
4. **HTML title + meta** in `apps/electron/index.html` and `apps/webui/**/*.html` — set `<title>ROX.ONE</title>` and `<meta name="application-name" content="ROX.ONE">`.
5. **Playground demo strings** in `apps/electron/src/renderer/playground/demos/messaging/*.tsx` — replace `"Craft Agents"` literals with `"ROX.ONE"`.

### New ticket

- `T263-rebrand-surface-text-completion` (single ticket; covers the five items above as one logical change).

### Validation

- `bun test packages/shared/src/i18n/__tests__/locale-parity.test.ts` (i18n key changes must keep en/ru parity).
- `bun run lint:i18n:parity`.
- `bun run validate:rebrand` (the forbidden-token gate from Phase R.0).
- Electron smoke: open the app, confirm window title is `ROX.ONE`.

### Stopping condition

- All five item classes touched; i18n parity preserved; the rebrand-lint gate passes for surface-text buckets only (other buckets still red — they are addressed in later phases).

---

# Phase R.2 — Code identifier renames

### Goal

Rename every `Craft*` class / interface / function / file that is not legal-preserve.

### Renames (representative; the lint script in Phase R.0 enumerates the full set)

- `CraftAppIcon` → `RoxAppIcon` (component + props + file `apps/electron/src/renderer/components/icons/CraftAppIcon.tsx` → `RoxAppIcon.tsx`).
- `CraftAgentsLogo` → `RoxAgentsLogo` (analogous).
- `CraftAgentsSymbol` → `RoxAgentsSymbol`.
- `CraftMcpClient` → `RoxMcpClient`.
- `CraftOAuth` → `RoxOAuth`.
- `CraftMetadataSchema` → `RoxAgentMetadataSchema`.
- File `packages/pi-agent-server/src/craft-metadata-schema.ts` → `rox-agent-metadata-schema.ts`.
- File `packages/shared/src/config/sync-craft-agent-bash-patterns.ts` → `sync-agent-bash-patterns.ts`.
- Test file `packages/shared/tests/permissions-craft-agent-sync.test.ts` → `permissions-agent-sync.test.ts`.
- Test file `packages/shared/src/agent/__tests__/permissions-config-craft-cli-flag.test.ts` → `permissions-config-cli-flag.test.ts`.
- Backward-compat **type alias** in `packages/shared/src/agent/claude-agent.ts`: keep `export type CraftAgentConfig = ClaudeAgentConfig` for one minor version with a `@deprecated` JSDoc tag pointing at the canonical name; remove in the next minor.

### New tickets

- `T264-rebrand-component-renames` — UI components (icons + their consumers).
- `T265-rebrand-class-renames` — non-UI class/interface renames + file renames.
- `T266-rebrand-test-file-renames` — test file renames + the `.snap` fixtures they reference.

### Validation

- Targeted: `bun test <renamed test files>` + adjacent component tests.
- `bun run typecheck`.
- `bun run lint`.
- Full `bun test` (since identifier renames ripple through imports).
- `bun run validate:rebrand`.

### Stopping condition

- The forbidden code-identifier list has zero matches outside legal-preserve.
- Backward-compat aliases are marked `@deprecated` with an explicit removal version.

---

# Phase R.3 — Asset file renames

### Goal

Rename branding-asset files that bake `craft` into their filename or directory path.

### Renames

- Directory `apps/electron/resources/craft-logos/` → `apps/electron/resources/rox-logos/`. Internal filenames `craft_app_icon.png` → `rox_app_icon.png`, `craft_logo_black.png` → `rox_logo_black.png`, etc.
- File `apps/electron/src/renderer/assets/craft_logo_c.svg` → `rox_logo_c.svg`.
- File `apps/electron/resources/tool-icons/craft-agent.png` → `apps/electron/resources/tool-icons/rox-agent.png`.
- Doc `apps/electron/resources/docs/craft-cli.md` → `rox-cli.md` (also rewrite all internal references in the doc body).
- CLI binaries `apps/electron/resources/bin/craft-agent` and `apps/electron/resources/bin/craft-agent.cmd` → `rox-agent` and `rox-agent.cmd` (also rewrite the launcher scripts that resolve these paths).
- Update every `import` / `require` / `<img src=>` / `electron-builder.yml` icon path that references the renamed assets.
- Update `apps/electron/scripts/afterPack.cjs` icon-freshness contract (T209) to point at the new asset names — keep the 1000 ms mtime-skew tolerance.

### New tickets

- `T267-rebrand-logo-asset-renames`.
- `T268-rebrand-binary-and-doc-renames`.

### Validation

- `bun test scripts/__tests__/mac-liquid-glass-icon-contract.test.ts` (the T209 contract continues to pass).
- `bun run build` (verifies asset bundling resolves the new paths).
- Electron smoke: app icon renders correctly in title bar and dock.

### Stopping condition

- Old asset filenames return zero `git ls-files` matches.
- The icon contract test is green against the new asset names.

---

# Phase R.4 — Documentation / decision-record / plan cleanup

### Goal

Rewrite ROX-authored docs that still reference legacy names. **Historical worklogs and tickets stay immutable.**

### In scope (rewritable)

- `README.md` — full sweep, replace any product references with `ROX.ONE`; keep upstream attribution.
- `CONTRIBUTING.md` — rewrite.
- `CODE_OF_CONDUCT.md` — rewrite contact email to `conduct@rox.one` (or whatever the canonical legal contact decides).
- `SECURITY.md` — rewrite vulnerability-report email to `security@rox.one`.
- `plan.md` — section 1 (Target Definition) is canonical; rewrite any stale text in §2–§17 that says "Craft" when it means the product. Add a header note: "Successor goal: this rebrand sweep (R.0–R.10)."
- `snapshot.md` — rewrite to current state; mark prior snapshot as historical.
- `apps/electron/README.md` — rewrite log paths and CLI names (`~/.craft-agent/logs/...` → `~/.rox/logs/...`).
- ADR `docs/decision-records/audit-harness/README.md` — add a forward-reference to ADR 0011 in Phase R.0.
- ADR `0005-storage-tenancy-contract.md` "Out of scope" section already references ADR 0007; no rename needed — but reword any "Craft Agents" prose to "ROX.ONE Agent Workbench Suite".

### Out of scope (immutable historical artifacts)

- `docs/worklog/T0*-*.md`, `docs/tickets/T0*-*.md`, `docs/worklog/T1*-*.md`, `docs/tickets/T1*-*.md` (and any worklog/ticket with `Status: DONE`).
- `apps/electron/resources/release-notes/*.md`.
- `docs/decision-records/audit-harness/0002-*.md` through `0006-*.md` (ADRs 0007 and later are revisable; 0002–0006 are historical).
- All `.brv/` and `.swarm/` state.

### New tickets

- `T269-rebrand-readme-and-contributing`.
- `T270-rebrand-security-and-coc`.
- `T271-rebrand-plan-and-snapshot-rewrite`.
- `T272-rebrand-electron-readme-and-paths`.

### Validation

- `bun run validate:docs`.
- `bun run validate:rebrand` for the doc-bucket subset.
- Manual diff review on README / plan / snapshot.

### Stopping condition

- Every in-scope doc carries only `ROX.ONE` / `Agent Workbench Suite` product references.
- Every historical artifact is untouched (proven by `git log` showing zero edits to files in the out-of-scope list).

---

# Phase R.5 — Package scope rename (HIGH IMPACT)

### Goal

Rename the workspace package scope `@craft-agent/*` → `@rox-one/*` across all 1,121 import sites.

### Approach

1. **One commit per package** for atomicity:
   - Rename the `name` field in `packages/<pkg>/package.json` from `@craft-agent/<pkg>` to `@rox-one/<pkg>`.
   - Update every `"@craft-agent/<pkg>": "workspace:*"` dependency reference in every other `package.json` to the new name.
   - Update every `import ... from '@craft-agent/<pkg>/...'` line in `*.ts` and `*.tsx` to the new scope.
   - Update tsconfig `paths` mappings in each `tsconfig*.json`.
2. **Root `package.json` name** stays `craft-agent` only if it remains the npm-published canonical package name; otherwise rename to `rox-one` (per Phase R.0 decision).
3. **bunfig.toml** workspace globs do not reference the scope, so no change there.
4. **Backward-compat re-exports** — for the two packages most consumed by external scripts (`@craft-agent/shared` and `@craft-agent/server-core`), publish a transitional shim that re-exports everything; keep the old name resolvable for one minor version.

### Ordering inside Phase R.5 (one PR per package, ten PRs total)

- R.5.1 `@craft-agent/test-fixtures` → `@rox-one/test-fixtures` (no production runtime).
- R.5.2 `@craft-agent/ui` → `@rox-one/ui`.
- R.5.3 `@craft-agent/core` → `@rox-one/core`.
- R.5.4 `@craft-agent/audit` → `@rox-one/audit`.
- R.5.5 `@craft-agent/session-tools-core` → `@rox-one/session-tools-core`.
- R.5.6 `@craft-agent/session-mcp-server` → `@rox-one/session-mcp-server`.
- R.5.7 `@craft-agent/messaging-gateway` → `@rox-one/messaging-gateway` (and `messaging-whatsapp-worker`).
- R.5.8 `@craft-agent/pi-agent-server` → `@rox-one/pi-agent-server`.
- R.5.9 `@craft-agent/server` and `@craft-agent/server-core` → `@rox-one/server`, `@rox-one/server-core`.
- R.5.10 `@craft-agent/shared` → `@rox-one/shared` (highest fan-in; landed last).
- R.5.11 Apps: `@craft-agent/cli`, `@craft-agent/electron`, `@craft-agent/viewer`, `@craft-agent/webui` → `@rox-one/<app>`.

Each sub-phase runs the full validation matrix before opening its PR. Sub-phases merge **strictly sequentially** — never two open at once, because each rename invalidates other open branches' import paths.

### New ticket cluster

- `T273-rebrand-pkg-scope-test-fixtures` through `T283-rebrand-pkg-scope-apps` (one ticket per sub-phase; 11 tickets).
- `T284-rebrand-pkg-scope-closeout` — final sweep ticket asserting zero `@craft-agent/` matches in `*.ts`, `*.tsx`, `package.json`, `tsconfig*.json`.

### Validation

- `bun install` resolves with no missing-package errors after each sub-phase.
- `bun run typecheck` green after each sub-phase.
- Full `bun test` green after each sub-phase.
- `bun run build` green after each sub-phase.

### Stopping condition

- `rg '@craft-agent/' --type ts --type json` returns zero matches (outside legal-preserve allowlist).
- Backward-compat shims for `shared` and `server-core` are published with explicit `@deprecated` JSDoc.

---

# Phase R.6 — Environment variable rename with backward-compat shim

### Goal

Rename the 14 `CRAFT_*` environment variables to `ROX_*` while keeping legacy `CRAFT_*` readable for one minor version.

### Renames (with shim)

| Legacy var | New var |
|---|---|
| `CRAFT_SERVER_TOKEN` | `ROX_SERVER_TOKEN` |
| `CRAFT_SERVER_URL` | `ROX_SERVER_URL` |
| `CRAFT_RPC_HOST` | `ROX_RPC_HOST` |
| `CRAFT_RPC_PORT` | `ROX_RPC_PORT` |
| `CRAFT_RPC_TLS_CERT` | `ROX_RPC_TLS_CERT` |
| `CRAFT_RPC_TLS_KEY` | `ROX_RPC_TLS_KEY` |
| `CRAFT_RPC_TLS_CA` | `ROX_RPC_TLS_CA` |
| `CRAFT_TLS_CA` | `ROX_TLS_CA` |
| `CRAFT_DEBUG` | `ROX_DEBUG` |
| `CRAFT_DEV_RUNTIME` | `ROX_DEV_RUNTIME` |
| `CRAFT_BUNDLED_ASSETS_ROOT` | `ROX_BUNDLED_ASSETS_ROOT` |
| `CRAFT_WEBUI_DIR` | `ROX_WEBUI_DIR` |
| `CRAFT_WEBUI_PORT` | `ROX_WEBUI_PORT` |
| `CRAFT_MESSAGING_WA_WORKER` | `ROX_MESSAGING_WA_WORKER` |
| `CRAFT_MESSAGING_NODE_BIN` | `ROX_MESSAGING_NODE_BIN` |
| `CRAFT_CONFIG_DIR` (test-only, from C.4) | `ROX_CONFIG_DIR` |

### Shim implementation

Add `packages/shared/src/utils/env-compat.ts`:

```ts
export function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (value !== undefined) return value;
  if (name.startsWith('ROX_')) {
    const legacy = 'CRAFT_' + name.slice('ROX_'.length);
    const legacyValue = process.env[legacy];
    if (legacyValue !== undefined) {
      emitDeprecationWarning(legacy, name);
      return legacyValue;
    }
  }
  return undefined;
}
```

Replace every direct `process.env.CRAFT_*` access with `readEnv('ROX_*')`. The shim warns on stderr the first time per process when a legacy var is read.

### New ticket cluster

- `T285-rebrand-env-var-shim-impl` — shim + tests.
- `T286-rebrand-env-var-call-site-migration` — every call site uses `readEnv()`.
- `T287-rebrand-env-var-docs-update` — README, Dockerfile, package.json scripts, .env.example all use `ROX_*`.
- `T288-rebrand-env-var-deprecation-warning-coverage` — test that proves the deprecation warning fires exactly once per legacy var per process.

### Validation

- `bun test packages/shared/src/utils/__tests__/env-compat.test.ts`.
- Full `bun test` (env-var changes ripple through tests that set them).
- Electron smoke with `CRAFT_SERVER_TOKEN` set → app starts + deprecation warning logged.
- Electron smoke with `ROX_SERVER_TOKEN` set → app starts + no warning.

### Stopping condition

- All call sites use `readEnv()`.
- The deprecation-warning test passes.
- README, Dockerfile, `.env.example`, every script in `package.json` use `ROX_*` names.

---

# Phase R.7 — Docker / CI / build rebrand

### Files and changes

1. `Dockerfile.server`:
   - Image build instruction (in the file header comment): `-t craft-agent-server` → `-t rox-one-server`.
   - System user/group: `useradd -r -g craftagents -m -d /home/craftagents` → `useradd -r -g roxone -m -d /home/roxone` (paths inside the image must follow).
   - Keep the `org.opencontainers.image.source` label pointing at `https://github.com/lukilabs/craft-agents-oss` (legal-preserve).
2. `.github/workflows/*.yml`:
   - Job names and step names that say "Craft" → "ROX.ONE".
   - Artifact names that say `craft-agent-*` → `rox-one-*`.
3. Root `package.json` scripts that pipe through `pgrep -f 'tail -f.*@craft-agent/electron/main.log'` → update to `@rox-one/electron`.
4. `.env.example` — rewrite all variable names to `ROX_*`.
5. `electron-builder.yml` — `productName` already says `ROX.ONE`; verify `appId` (likely `one.rox.workbench` or similar) is canonical.

### New ticket cluster

- `T289-rebrand-dockerfile`.
- `T290-rebrand-ci-workflows`.
- `T291-rebrand-electron-builder-config`.

### Validation

- `docker buildx build -f Dockerfile.server -t rox-one-server .` succeeds locally.
- GitHub Actions dry-run on the PR shows the workflow with new names.
- `bun run electron:build` produces an artifact with the new `appId`.

### Stopping condition

- `grep -E 'craft' Dockerfile.server .env.example` finds only legal-preserve allowlisted matches.
- CI artifacts use the new names.

---

# Phase R.8 — User-data migration shim

### Goal

A clean upgrade path for users who already have `~/.craft/` or `~/.craft-agent/logs/` from earlier ROX.ONE installs.

### Approach

Add `packages/shared/src/config/user-data-migration.ts` that runs once on app start:

1. Detect legacy paths in priority order: `~/.craft-agent/`, `~/.craft/`.
2. If a legacy path exists and `~/.rox/` does not exist, **copy** (not move) the entire tree to `~/.rox/`, then write a `.migrated-from-craft` marker inside `~/.rox/`.
3. If both legacy and `~/.rox/` exist, do not migrate; log a warning instructing the user to consolidate manually.
4. Log the migration once at info level; never run again.

### New ticket cluster

- `T292-user-data-migration-design` — short design doc in `docs/superpowers/specs/`.
- `T293-user-data-migration-impl` — implementation + tests with fixture filesystems.
- `T294-user-data-migration-electron-startup-wire` — wires the migration into Electron main-process startup before `ensureConfigDir()`.

### Validation

- `bun test packages/shared/src/config/__tests__/user-data-migration.test.ts` with fixture filesystems.
- Manual smoke: create a fake `~/.craft/` in a sandbox, run the app, confirm `~/.rox/` exists with the same contents and `.migrated-from-craft` marker.

### Stopping condition

- The migration test covers: (a) no legacy path → no-op, (b) legacy only → copy, (c) both exist → warn + no-op, (d) re-run after marker → no-op.
- The Electron startup test confirms the migration runs before any storage read.

---

# Phase R.9 — Community-link audit

### Goal

Replace every link that *implies* the project is still part of the upstream community (Discord, Twitter/X, docs site, forum, issue tracker on the upstream repo) with the equivalent ROX.ONE-owned destination — *while preserving the source-repo URL where Apache 2.0 attribution requires it*.

### Process

1. Run `rg -i 'discord|twitter\.com|x\.com|community\.|forum\.|docs\..*craft' .` (excluding allowlist).
2. For each hit:
   - If the link points to upstream support (Discord, Twitter, forum), replace with the ROX.ONE equivalent (`https://discord.gg/<rox-one-invite>`, `https://x.com/rox_one`, `https://rox.one/community`).
   - If the link is in `LICENSE`, `NOTICE`, or `Dockerfile.server`'s `image.source` label, **preserve**.
   - If the link is a GitHub issue reference in historical release notes, **preserve** (historical record).

### New ticket

- `T295-community-link-audit-and-fix`.

### Validation

- A new regression test in `scripts/__tests__/community-link-audit.test.ts` that fails if any of the forbidden community-link patterns appears outside the legal-preserve allowlist.
- Manual click-through on every replaced link to confirm the destination is alive.

### Stopping condition

- The community-link regression test is green.
- The final list of preserved upstream links is documented in `docs/release/rebrand-mapping-2026-05-13.md` under "Legal preserve — community links".

---

# Phase R.10 — Final sweep + closeout

### Goal

Prove the rebrand is complete and irreversibly enforced.

### Work

1. Run the **forbidden-token grep** with no allowlist exclusions and inspect every hit. If any hit is outside the allowlist, open a fix ticket and resolve before claiming closeout.
2. Author `docs/worklog/T296-rebrand-sweep-closeout.md` — the 11-section closeout worklog summarizing every phase, every commit SHA, every ticket.
3. Tag the closeout commit `rebrand-v1` so future merges can fast-forward past it cleanly.
4. Update `plan.md` §1 (Target Definition) to read in the canonical voice: "ROX.ONE Agent Workbench Suite", removing any "Craft" residue from the product description.
5. Update `package.json` `version` if Phase R.5 changed the publishable package identity; bump per `<git_and_versioning>` semver rules (this is a MAJOR change if package names were renamed).
6. Add `bun run validate:rebrand` to the **`prepush` git hook** and the **CI matrix** so any future regression fails closed.

### New tickets

- `T296-rebrand-sweep-closeout`.
- `T297-rebrand-prepush-hook-and-ci-gate`.

### Validation

- `bun run validate:rebrand` exits 0 on the closeout commit.
- The prepush hook rejects a deliberately-bad commit that reintroduces `@craft-agent/shared` somewhere.
- Full master-roadmap global validation matrix is still green (so the rebrand did not regress anything upstream).

### Stopping condition

- `bun run validate:rebrand` is part of CI.
- `rebrand-v1` tag is pushed.
- T296 and T297 `Status: DONE`.

---

# Global stopping condition

All of:

1. T260–T297 `Status: DONE` with matching worklogs and commit SHAs.
2. `bun run validate:rebrand` green on `main`.
3. `bun run typecheck`, full `bun test`, `bun run lint`, `bun run build`, `bun run validate:docs`, `bun run validate:agent-contract` all green on `main`.
4. The master roadmap's Phase 2 (RBAC) is unblocked — i.e. the package-scope rename in Phase R.5 has completed cleanly so RBAC work can land in the new scope.
5. `rebrand-v1` tag exists on `main`.
6. `docs/release/rebrand-mapping-2026-05-13.md` is updated with closeout commit SHAs.

# Stop and ask if

- The C.4 follow-on closeout (`T222-c4-followups-closeout`) is not yet `Status: DONE` when you start Phase R.5 — package-scope renames will collide with active C.4 import-path changes.
- A legal-preserve allowlist entry is ambiguous — Apache 2.0 attribution boundaries are non-negotiable, ask before editing.
- Phase R.5 finds an unexpected package scope (e.g. a third-party fork shipping `@craft-agent/*` under a different license) — the rebrand must not break legitimate downstream users without notice.
- The migration shim in Phase R.8 detects user data that does not match the expected schema — ask before copying anything destructive.
- Phase R.6's deprecation warning interferes with a test that asserts a clean stderr — fix the test, do not silence the warning.

# Resumption protocol

1. Read `.swarm/master-roadmap-log.md`; the last appended `R.N` line names the most recently completed rebrand phase.
2. Verify the listed commit SHA via `git log --oneline | grep <sha>`.
3. Re-run Step zero (fast-forward `main`).
4. Re-read this file and the next phase's *Read first* list.
5. Resume from the first phase whose closeout ticket is not yet `Status: DONE`.

# Coordination with the master roadmap

- This `/goal` **must** be invoked *after* the master roadmap's Phase 1 closeout commit lands on `main`. Concurrent execution with C.4 follow-ons will produce unrecoverable merge conflicts in the import graph.
- After Phase R.5 (package scope rename) lands, the master roadmap's Phase 2 (RBAC) and beyond will reference `@rox-one/*` instead of `@craft-agent/*`. Update the master roadmap's "Read first" lists in a single follow-up commit to reflect the new scope.
- Phase R.7's Docker rebuild may invalidate cached CI artifacts; expect a one-time slower CI run after R.7 lands.

# The `/goal` invocation (single short line to paste into Codex)

```
/goal follow the instructions in docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md
```

That line is 102 characters — well under codex's 4 000-char limit.
