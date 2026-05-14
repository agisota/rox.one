# Codex `/goal` — ROX ONE Rebrand Sweep

> **SUPERSEDED for the global picture by the spine roadmap:**
> [`2026-05-13-rox-one-v1-end-to-end-spine-goal.md`](./2026-05-13-rox-one-v1-end-to-end-spine-goal.md).
>
> This file remains the canonical *phase-detail* reference for rebrand
> phases **R.0 through R.11**. The spine document owns global sequencing,
> dependencies, the unified ticket schema, and Lane P (post-release).
> Codex should invoke the spine and let it dispatch to phase-detail files
> as needed.

**Date:** 2026-05-13
**Author:** Branding lane
**Sibling of:** `2026-05-13-agent-workbench-suite-master-roadmap-goal.md`
**Slot:** between master-roadmap Phase 1 (C.4 follow-ons closeout) and Phase 2 (RBAC slice) — inserts as **Phase 1.7**
**Audience:** Codex CLI in autonomous `/goal` mode (or human operator)

## User-locked decisions (2026-05-13)

The operator made four scope-locking decisions before any rebrand work was authorized. They are non-negotiable for this `/goal` run.

| # | Decision | Locked value | Notes |
|---|---|---|---|
| 1 | **Canonical brand token** | `ROX.ONE` (wordmark, with dot) + `ROX ONE` (spoken form) | Wordmark goes everywhere written: README, code, `package.json`, ADRs, brand assets. Spoken form is for voice-over / marketing audio only and does not appear in code. |
| 2 | **Package scope** | `@rox-one/*` (kebab-case) | Matches the existing `@rox-one/marketing` package already present in the repo. |
| 3 | **Coordination with master roadmap** | Wait for `T223-c4-followups-closeout` to be `Status: DONE` before invoking this `/goal` | Concurrent execution with C.4 follow-on phases is forbidden by Phase R.5's import-graph collision risk. |
| 4 | **Git history rewrite** | **Authorized** — via `git filter-repo` in new Phase R.11, *as the last step before the v1.0.0 release tag* | The operator explicitly waived the CLAUDE.md "never force-push to main" rule for this one-time pre-release cleanup. R.11 has its own destructive-action safeguards. |

## Mega-Objective

Drive a **comprehensive, sweep-style rebrand** of the entire `rox-one-terminal` repository so that:

1. Every user-visible and developer-visible reference to **"Rox" / "rox-agent" / "Rox Agents"** as a product is replaced with the canonical **ROX.ONE** / **Agent Workbench Suite** branding.
2. No third-party "community" link (Discord, forum, social, docs site) belonging to upstream remains pointing outside ROX.ONE.
3. All required upstream attribution under Apache 2.0 §4 (`LICENSE`, `NOTICE`, `TRADEMARK.md`, the `https://github.com/lukilabs/rox-agents-oss` source-URL labels in `Dockerfile.server`) is **preserved exactly** — the rebrand renames the *product*, not the *attribution*.
4. Existing single-user installs continue to work after upgrade — config-dir, env-var, and credential-store migrations are shimmed, not break-changed.
5. A final grep gate (`rg -i 'rox' <repo>` outside the legal-preserve allowlist) returns **zero** matches.

This goal is **inserted between master-roadmap Phase 1 (C.4 follow-ons closeout) and Phase 2 (RBAC)**. It does *not* run in parallel with C.4 work because Phase R.5 (package scope rename) touches the same import graph that C.4 Phase 1.x is actively modifying. Wait for `T223-c4-followups-closeout` to be `Status: DONE` before invoking this `/goal`.

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
- **TDD-first** even for refactors: every rename ticket adds a grep-based regression test (e.g. `expect grep -r 'RoxAppIcon' src to find zero matches`) before claiming green.
- Atomic Lore-style commits; one ticket = one commit.
- **No direct `main` pushes.** Each phase opens a feature branch named `chore/rebrand-R<n>-<slug>` and merges via PR after the phase's stopping condition is green.
- Run the global validation matrix below before every PR open.

## Mandatory phase pre-check (run before every R.N phase)

Before starting any phase R.0 through R.11, run this resumption check:

1. Read `.swarm/master-roadmap-log.md` and the phase's ticket list.
2. If every ticket for the phase is already `Status: DONE`, verify each ticket has a matching 11-section worklog and a referenced commit SHA.
3. If the phase is complete but `.swarm/master-roadmap-log.md` lacks an `R.N` entry, append one line in this format and commit only that log update:

   ```text
   rebrand-R.N-<slug> | <commit-sha> | <ticket-list> | <ISO-8601 UTC timestamp>
   ```

4. If the log line already exists, do not duplicate it; skip to the next phase.
5. If any phase ticket is not `Status: DONE`, resume from the first incomplete ticket in that phase.

This pre-check is the required DONE-phase skip-and-log block for **every** rebrand phase. It prevents resumed `/goal` runs from redoing already-landed phases or silently losing closeout evidence.

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
git -C . log --oneline | grep -E "T223-c4-followups-closeout|Phase 1 closeout" || \
  echo "BLOCKED: C.4 follow-ons not yet closed. STOP and wait for master roadmap Phase 1."
```

If the closeout marker is missing, **stop and report**. Do not start Phase R.0 while codex is still landing C.4 follow-on commits — package-scope renames in Phase R.5 will collide with active import-path changes.

---

# Phase R.0 — Canonical brand decision + rebrand inventory

The whole sweep depends on three locked decisions. Encode them in a single ADR before any rename begins.

### Locked decisions to record (already user-confirmed; copy verbatim into ADR 0011)

1. **Canonical product brand token:** `ROX.ONE` (wordmark, with dot) — written form everywhere in code, docs, package names, brand assets. Spoken form `ROX ONE` is reserved for voice/marketing audio only and never appears in source files. `Agent Workbench Suite` is the suite descriptor below the product name where context demands it (per `plan.md §1`). **User-locked 2026-05-13.**
2. **Package scope:** `@rox-one/*` (kebab-case). Matches existing `@rox-one/marketing` already in the workspace. **User-locked 2026-05-13.**
3. **Env-var prefix policy:** `ROX_*` for all new vars; legacy `ROX_*` names continue to be read for **one minor version** via the `readEnv()` shim (Phase R.6) with a per-process deprecation warning, then dropped. Migration shims are *mandatory*, not optional.

### New ticket cluster

- `T260-rebrand-canonical-decision-adr` — writes ADR `0011-rox-one-rebrand-canonical-tokens.md` capturing the three decisions above plus the legal-preserve allowlist.
- `T261-rebrand-mapping-report` — generates `docs/release/rebrand-mapping-2026-05-13.md` (the post-sweep audit baseline) by running structured `ripgrep` over every bucket from the rebrand-mapping survey already in this repo's history.
- `T262-rebrand-lint-script` — adds `scripts/validate-rebrand.cjs` and wires it as `bun run validate:rebrand` in root `package.json`. The script greps for the forbidden-token list and the legal-preserve allowlist; exits non-zero if any forbidden token appears outside the allowlist.

### Forbidden-token list (denied unless allowlisted)

```
rox-agent
@rox-agent
ROX_              (env-var prefix at line start, except the deprecation-shim definitions)
~/.rox
.rox-agent
Rox Agents
Rox Agent
RoxAppIcon
RoxAgentsLogo
RoxAgentsSymbol
RoxMcpClient
RoxOAuth
RoxMetadataSchema
rox-cli
rox-logos
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
docs/worklog/T1*-*.md                   # historical DONE worklogs are immutable
docs/tickets/T1*-*.md                   # historical DONE tickets are immutable
docs/worklog/T2*-*.md                   # historical or completed rebrand worklogs are immutable once DONE
docs/tickets/T2*-*.md                   # historical or completed rebrand tickets are immutable once DONE
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
   - `menu.roxMenu` → rename key to `menu.appMenu` (update all consumers).
   - `onboarding.apiSetup.roxAgentsBackend` → rename key to `onboarding.apiSetup.roxBackend` (update consumers).
   - Audit every value string for `Rox Agents` / `Rox Agent` literal mentions; rewrite to `ROX.ONE` or `Agent Workbench Suite` per context.
2. **README.md** — replace any remaining `Rox Agents` body text with `ROX.ONE`. Keep the "Acknowledgements" / "License" section's upstream attribution intact (this is legal-preserve).
3. **`apps/electron/resources/docs/automations.md`** — replace `~/.rox-agent/logs/messaging-gateway.log` with `~/.rox/logs/messaging-gateway.log`.
4. **HTML title + meta** in `apps/electron/index.html` and `apps/webui/**/*.html` — set `<title>ROX.ONE</title>` and `<meta name="application-name" content="ROX.ONE">`.
5. **Playground demo strings** in `apps/electron/src/renderer/playground/demos/messaging/*.tsx` — replace `"Rox Agents"` literals with `"ROX.ONE"`.

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

Rename every `Rox*` class / interface / function / file that is not legal-preserve.

### Renames (representative; the lint script in Phase R.0 enumerates the full set)

- `RoxAppIcon` → `RoxAppIcon` (component + props + file `apps/electron/src/renderer/components/icons/RoxAppIcon.tsx` → `RoxAppIcon.tsx`).
- `RoxAgentsLogo` → `RoxAgentsLogo` (analogous).
- `RoxAgentsSymbol` → `RoxAgentsSymbol`.
- `RoxMcpClient` → `RoxMcpClient`.
- `RoxOAuth` → `RoxOAuth`.
- `RoxMetadataSchema` → `RoxAgentMetadataSchema`.
- File `packages/pi-agent-server/src/rox-metadata-schema.ts` → `rox-agent-metadata-schema.ts`.
- File `packages/shared/src/config/sync-rox-agent-bash-patterns.ts` → `sync-agent-bash-patterns.ts`.
- Test file `packages/shared/tests/permissions-rox-agent-sync.test.ts` → `permissions-agent-sync.test.ts`.
- Test file `packages/shared/src/agent/__tests__/permissions-config-rox-cli-flag.test.ts` → `permissions-config-cli-flag.test.ts`.
- Backward-compat **type alias** in `packages/shared/src/agent/claude-agent.ts`: keep `export type RoxAgentConfig = ClaudeAgentConfig` for one minor version with a `@deprecated` JSDoc tag pointing at the canonical name; remove in the next minor.

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

Rename branding-asset files that bake `rox` into their filename or directory path.

### Renames

- Directory `apps/electron/resources/rox-logos/` → `apps/electron/resources/rox-logos/`. Internal filenames `rox_app_icon.png` → `rox_app_icon.png`, `rox_logo_black.png` → `rox_logo_black.png`, etc.
- File `apps/electron/src/renderer/assets/rox_logo_c.svg` → `rox_logo_c.svg`.
- File `apps/electron/resources/tool-icons/rox-agent.png` → `apps/electron/resources/tool-icons/rox-agent.png`.
- Doc `apps/electron/resources/docs/rox-cli.md` → `rox-cli.md` (also rewrite all internal references in the doc body).
- CLI binaries `apps/electron/resources/bin/rox-agent` and `apps/electron/resources/bin/rox-agent.cmd` → `rox-agent` and `rox-agent.cmd` (also rewrite the launcher scripts that resolve these paths).
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
- `plan.md` — section 1 (Target Definition) is canonical; rewrite any stale text in §2–§17 that says "Rox" when it means the product. Add a header note: "Successor goal: this rebrand sweep (R.0–R.10)."
- `snapshot.md` — rewrite to current state; mark prior snapshot as historical.
- `apps/electron/README.md` — rewrite log paths and CLI names (`~/.rox-agent/logs/...` → `~/.rox/logs/...`).
- ADR `docs/decision-records/audit-harness/README.md` — add a forward-reference to ADR 0011 in Phase R.0.
- ADR `0005-storage-tenancy-contract.md` "Out of scope" section already references ADR 0007; no rename needed — but reword any "Rox Agents" prose to "ROX.ONE Agent Workbench Suite".

### Out of scope (immutable historical artifacts)

- `docs/worklog/T0*-*.md`, `docs/tickets/T0*-*.md`, `docs/worklog/T1*-*.md`, `docs/tickets/T1*-*.md`, `docs/worklog/T2*-*.md`, `docs/tickets/T2*-*.md` (and any worklog/ticket with `Status: DONE`).
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

Rename the workspace package scope `@rox-agent/*` → `@rox-one/*` across all 1,121 import sites.

### Approach

1. **One commit per package** for atomicity:
   - Rename the `name` field in `packages/<pkg>/package.json` from `@rox-agent/<pkg>` to `@rox-one/<pkg>`.
   - Update every `"@rox-agent/<pkg>": "workspace:*"` dependency reference in every other `package.json` to the new name.
   - Update every `import ... from '@rox-agent/<pkg>/...'` line in `*.ts` and `*.tsx` to the new scope.
   - Update tsconfig `paths` mappings in each `tsconfig*.json`.
2. **Root `package.json` name** stays `rox-agent` only if it remains the npm-published canonical package name; otherwise rename to `rox-one` (per Phase R.0 decision).
3. **bunfig.toml** workspace globs do not reference the scope, so no change there.
4. **Backward-compat re-exports** — for the two packages most consumed by external scripts (`@rox-agent/shared` and `@rox-agent/server-core`), publish a transitional shim that re-exports everything; keep the old name resolvable for one minor version.

### Ordering inside Phase R.5 (one PR per package/app group, eleven PRs total)

- R.5.1 `@rox-agent/test-fixtures` → `@rox-one/test-fixtures` (no production runtime).
- R.5.2 `@rox-agent/ui` → `@rox-one/ui`.
- R.5.3 `@rox-agent/core` → `@rox-one/core`.
- R.5.4 `@rox-agent/audit` → `@rox-one/audit`.
- R.5.5 `@rox-agent/session-tools-core` → `@rox-one/session-tools-core`.
- R.5.6 `@rox-agent/session-mcp-server` → `@rox-one/session-mcp-server`.
- R.5.7 `@rox-agent/messaging-gateway` → `@rox-one/messaging-gateway` (and `messaging-whatsapp-worker`).
- R.5.8 `@rox-agent/pi-agent-server` → `@rox-one/pi-agent-server`.
- R.5.9 `@rox-agent/server` and `@rox-agent/server-core` → `@rox-one/server`, `@rox-one/server-core`.
- R.5.10 `@rox-agent/shared` → `@rox-one/shared` (highest fan-in; landed last).
- R.5.11 Apps: `@rox-agent/cli`, `@rox-agent/electron`, `@rox-agent/viewer`, `@rox-agent/webui` → `@rox-one/<app>`.

Each sub-phase runs the full validation matrix before opening its PR. Sub-phases merge **strictly sequentially** — never two open at once, because each rename invalidates other open branches' import paths.

### New ticket cluster

- `T273-rebrand-pkg-scope-test-fixtures` through `T283-rebrand-pkg-scope-apps` (one ticket per sub-phase; 11 tickets).
- `T284-rebrand-pkg-scope-closeout` — final sweep ticket asserting zero `@rox-agent/` matches in `*.ts`, `*.tsx`, `package.json`, `tsconfig*.json`.

### Validation

- `bun install` resolves with no missing-package errors after each sub-phase.
- `bun run typecheck` green after each sub-phase.
- Full `bun test` green after each sub-phase.
- `bun run build` green after each sub-phase.

### Stopping condition

- `rg '@rox-agent/' --type ts --type json` returns zero matches (outside legal-preserve allowlist).
- Backward-compat shims for `shared` and `server-core` are published with explicit `@deprecated` JSDoc.

---

# Phase R.6 — Environment variable rename with backward-compat shim

### Goal

Rename the 16 `ROX_*` environment variables to `ROX_*` while keeping legacy `ROX_*` readable for one minor version.

### Renames (with shim)

| Legacy var | New var |
|---|---|
| `ROX_SERVER_TOKEN` | `ROX_SERVER_TOKEN` |
| `ROX_SERVER_URL` | `ROX_SERVER_URL` |
| `ROX_RPC_HOST` | `ROX_RPC_HOST` |
| `ROX_RPC_PORT` | `ROX_RPC_PORT` |
| `ROX_RPC_TLS_CERT` | `ROX_RPC_TLS_CERT` |
| `ROX_RPC_TLS_KEY` | `ROX_RPC_TLS_KEY` |
| `ROX_RPC_TLS_CA` | `ROX_RPC_TLS_CA` |
| `ROX_TLS_CA` | `ROX_TLS_CA` |
| `ROX_DEBUG` | `ROX_DEBUG` |
| `ROX_DEV_RUNTIME` | `ROX_DEV_RUNTIME` |
| `ROX_BUNDLED_ASSETS_ROOT` | `ROX_BUNDLED_ASSETS_ROOT` |
| `ROX_WEBUI_DIR` | `ROX_WEBUI_DIR` |
| `ROX_WEBUI_PORT` | `ROX_WEBUI_PORT` |
| `ROX_MESSAGING_WA_WORKER` | `ROX_MESSAGING_WA_WORKER` |
| `ROX_MESSAGING_NODE_BIN` | `ROX_MESSAGING_NODE_BIN` |
| `ROX_CONFIG_DIR` (test-only, from C.4) | `ROX_CONFIG_DIR` |

### Shim implementation

Add `packages/shared/src/utils/env-compat.ts`:

```ts
const warnedLegacyEnvVars = new Set<string>();

function emitEnvDeprecationWarning(legacyName: string, newName: string): void {
  if (warnedLegacyEnvVars.has(legacyName)) return;
  warnedLegacyEnvVars.add(legacyName);
  console.warn(
    `[env] ${legacyName} is deprecated; use ${newName}. ` +
      'The legacy ROX_* fallback will be removed after one minor version.',
  );
}

export function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (value !== undefined) return value;
  if (name.startsWith('ROX_')) {
    const legacy = 'ROX_' + name.slice('ROX_'.length);
    const legacyValue = process.env[legacy];
    if (legacyValue !== undefined) {
      emitEnvDeprecationWarning(legacy, name);
      return legacyValue;
    }
  }
  return undefined;
}
```

Replace every direct `process.env.ROX_*` access with `readEnv('ROX_*')`. The shim warns on stderr the first time per process when a legacy var is read.

### New ticket cluster

- `T285-rebrand-env-var-shim-impl` — shim + tests.
- `T286-rebrand-env-var-call-site-migration` — every call site uses `readEnv()`.
- `T287-rebrand-env-var-docs-update` — README, Dockerfile, package.json scripts, .env.example all use `ROX_*`.
- `T288-rebrand-env-var-deprecation-warning-coverage` — test that proves the deprecation warning fires exactly once per legacy var per process.

### Validation

- `bun test packages/shared/src/utils/__tests__/env-compat.test.ts`.
- Full `bun test` (env-var changes ripple through tests that set them).
- Electron smoke with `ROX_SERVER_TOKEN` set → app starts + deprecation warning logged.
- Electron smoke with `ROX_SERVER_TOKEN` set → app starts + no warning.

### Stopping condition

- All call sites use `readEnv()`.
- The deprecation-warning test passes.
- README, Dockerfile, `.env.example`, every script in `package.json` use `ROX_*` names.

---

# Phase R.7 — Docker / CI / build rebrand

### Files and changes

1. `Dockerfile.server`:
   - Image build instruction (in the file header comment): `-t rox-agent-server` → `-t rox-one-server`.
   - System user/group: `useradd -r -g roxagents -m -d /home/roxagents` → `useradd -r -g roxone -m -d /home/roxone` (paths inside the image must follow).
   - Keep the `org.opencontainers.image.source` label pointing at `https://github.com/lukilabs/rox-agents-oss` (legal-preserve).
2. `.github/workflows/*.yml`:
   - Job names and step names that say "Rox" → "ROX.ONE".
   - Artifact names that say `rox-agent-*` → `rox-one-*`.
3. Root `package.json` scripts that pipe through `pgrep -f 'tail -f.*@rox-agent/electron/main.log'` → update to `@rox-one/electron`.
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

- `grep -E 'rox' Dockerfile.server .env.example` finds only legal-preserve allowlisted matches.
- CI artifacts use the new names.

---

# Phase R.8 — User-data migration shim

### Goal

A clean upgrade path for users who already have `~/.rox/` or `~/.rox-agent/logs/` from earlier ROX.ONE installs.

### Approach

Add `packages/shared/src/config/user-data-migration.ts` that runs once on app start:

1. Detect legacy paths in priority order: `~/.rox-agent/`, `~/.rox/`.
2. If a legacy path exists and `~/.rox/` does not exist, **copy** (not move) the entire tree to `~/.rox/`, then write a `.migrated-from-rox` marker inside `~/.rox/`.
3. If both legacy and `~/.rox/` exist, do not migrate; log a warning instructing the user to consolidate manually.
4. Log the migration once at info level; never run again.

### New ticket cluster

- `T292-user-data-migration-design` — short design doc in `docs/superpowers/specs/`.
- `T293-user-data-migration-impl` — implementation + tests with fixture filesystems.
- `T294-user-data-migration-electron-startup-wire` — wires the migration into Electron main-process startup before `ensureConfigDir()`.

### Validation

- `bun test packages/shared/src/config/__tests__/user-data-migration.test.ts` with fixture filesystems.
- Manual smoke: create a fake `~/.rox/` in a sandbox, run the app, confirm `~/.rox/` exists with the same contents and `.migrated-from-rox` marker.

### Stopping condition

- The migration test covers: (a) no legacy path → no-op, (b) legacy only → copy, (c) both exist → warn + no-op, (d) re-run after marker → no-op.
- The Electron startup test confirms the migration runs before any storage read.

---

# Phase R.9 — Community-link audit

### Goal

Replace every link that *implies* the project is still part of the upstream community (Discord, Twitter/X, docs site, forum, issue tracker on the upstream repo) with the equivalent ROX.ONE-owned destination — *while preserving the source-repo URL where Apache 2.0 attribution requires it*.

### Process

1. Run `rg -i 'discord|twitter\.com|x\.com|community\.|forum\.|docs\..*rox' .` (excluding allowlist).
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
4. Update `plan.md` §1 (Target Definition) to read in the canonical voice: "ROX.ONE Agent Workbench Suite", removing any "Rox" residue from the product description.
5. Update `package.json` `version` if Phase R.5 changed the publishable package identity; bump per `<git_and_versioning>` semver rules (this is a MAJOR change if package names were renamed).
6. Add `bun run validate:rebrand` to the **`prepush` git hook** and the **CI matrix** so any future regression fails closed.

### New tickets

- `T296-rebrand-sweep-closeout`.
- `T297-rebrand-prepush-hook-and-ci-gate`.

### Validation

- `bun run validate:rebrand` exits 0 on the closeout commit.
- The prepush hook rejects a deliberately-bad commit that reintroduces `@rox-agent/shared` somewhere.
- Full master-roadmap global validation matrix is still green (so the rebrand did not regress anything upstream).

### Stopping condition

- `bun run validate:rebrand` is part of CI.
- `rebrand-v1` tag is pushed.
- T296 and T297 `Status: DONE`.

---

# Phase R.11 — Git history rewrite (DESTRUCTIVE, user-authorized)

### Goal

Scrub legacy `rox-agent` / `Rox Agents` brand text from the **entire git history** of `main` so that even `git log -p` and `git blame` show only the canonical `ROX.ONE` / `@rox-one/*` voice. This is the *single* destructive operation in the whole rebrand and runs **only after every other phase has merged and stabilized**.

### Authorization

The operator explicitly waived the CLAUDE.md `<git_and_versioning>` rule "Never `git push --force` to `main`/`master`" for this one-time pre-release cleanup on 2026-05-13 (decision #4 in the "User-locked decisions" table at the top of this file). The waiver applies *only* to Phase R.11 and *only* to the agisota/rox-one-terminal repository.

### Hard prerequisites (every one must be true before R.11 starts)

1. R.0 through R.10 are all `Status: DONE` with matching closeout tickets.
2. The master roadmap's Phase 1 closeout (`T223`) is `Status: DONE`.
3. The master roadmap's Phase 2 (RBAC) closeout (`T229`) is `Status: DONE` and merged on `main`. *Reason: RBAC is the consumer of C.4; we want it on the rewritten ancestry, not stuck on an old one.*
4. **Every open PR** is either merged or closed. Confirm with `gh pr list --state open --limit 200` → empty list.
5. **No active codex `/goal` runs.** Confirm in codex with `/goal` (no args) → "no active goal". If codex shows an active goal, `/goal pause` first; do not resume until R.11 closeout.
6. **No third-party forks expected to upstream.** Confirm by listing `gh api repos/agisota/rox-one-terminal/forks` and checking the count is what you expect (typically zero or one for backup).
7. The `rebrand-v1` tag from Phase R.10 exists.
8. Local working tree is clean: `git status --porcelain` → empty.
9. Local `main` is in sync with `origin/main`: `git rev-list --left-right --count origin/main...HEAD` → `0	0`.

Use the report-only helper: run `bun run rebrand:r11-preflight` before any
backup step. The helper checks the local/remote prerequisites it can verify
and exits non-zero while R.11 is blocked. It does not replace the manual
`/goal` check, fork review, or human decision to proceed.

If **any** prerequisite fails, **stop and report**. Do not partially execute R.11 — it is all-or-nothing.

### Backup procedure (mandatory)

```bash
# 1. Snapshot the current state to a backup tag and push it.
git -C . tag -a pre-rebrand-history-rewrite-backup -m "Backup before R.11 git filter-repo on 2026-05-13"
git -C . push origin pre-rebrand-history-rewrite-backup

# 2. Verify the backup tag is visible on the remote.
git -C . ls-remote --tags origin pre-rebrand-history-rewrite-backup

# 3. Create a parallel backup branch and push it (belt-and-braces).
git -C . switch -c backup/pre-rebrand-history-rewrite-2026-05-13 main
git -C . push origin backup/pre-rebrand-history-rewrite-2026-05-13
git -C . switch main

# 4. Locally clone a second copy of the repo as an offline backup.
#    This survives even a catastrophic mistake on origin.
cd /tmp && git clone --mirror file:///home/dev/rox/rox-one-terminal \
  /tmp/rox-one-terminal-backup-2026-05-13.git
```

The backup tag and the offline mirror must **both** exist before any filter-repo invocation. Confirm with `ls -la /tmp/rox-one-terminal-backup-2026-05-13.git` and `git ls-remote --tags origin | grep pre-rebrand`, then run the explicit pre-rewrite helper gate:

```bash
bun run rebrand:r11-preflight --stage pre-rewrite
```

If the pre-rewrite helper exits non-zero, **stop**. Do not run `git filter-repo`.

### Filter-repo plan

Use `git-filter-repo` (the modern replacement for `git filter-branch`; install with `pip install git-filter-repo` if not present). Two passes:

**Pass 1 — Commit message rewrite** (changes commit subjects/bodies but not tree contents):

```bash
git -C . filter-repo --force \
  --replace-message <(cat <<'EOF'
rox-agent==>rox-one
@rox-agent==>@rox-one
Rox Agents==>ROX.ONE
Rox Agent==>ROX.ONE
ROX_==>ROX_
rox-ai-agents/rox-agents-oss==>rox-ai-agents/rox-agents-oss
lukilabs/rox-agents-oss==>lukilabs/rox-agents-oss
EOF
)
```

*The last two lines are no-ops — they exist to **prevent** the rule above from rewriting attribution URLs that must remain pointing at the legitimate upstream source. `git-filter-repo` applies rules top-down with last-match-wins.*

**Pass 2 — Path-name rewrite** (changes file paths in history so `git log --follow` shows the rebranded names):

```bash
git -C . filter-repo --force \
  --path-rename packages/shared/src/config/sync-rox-agent-bash-patterns.ts:packages/shared/src/config/sync-agent-bash-patterns.ts \
  --path-rename packages/pi-agent-server/src/rox-metadata-schema.ts:packages/pi-agent-server/src/rox-agent-metadata-schema.ts \
  --path-rename apps/electron/resources/rox-logos:apps/electron/resources/rox-logos \
  --path-rename apps/electron/resources/bin/rox-agent:apps/electron/resources/bin/rox-agent \
  --path-rename apps/electron/resources/docs/rox-cli.md:apps/electron/resources/docs/rox-cli.md
```

### Legal-preserve checks (run AFTER filter-repo, BEFORE push)

```bash
# 1. LICENSE, NOTICE, TRADEMARK.md must be byte-identical to pre-rewrite versions.
git show pre-rebrand-history-rewrite-backup:LICENSE > /tmp/license.before
git show HEAD:LICENSE > /tmp/license.after
diff -q /tmp/license.before /tmp/license.after  # MUST output nothing

git show pre-rebrand-history-rewrite-backup:NOTICE > /tmp/notice.before
git show HEAD:NOTICE > /tmp/notice.after
diff -q /tmp/notice.before /tmp/notice.after  # MUST output nothing

git show pre-rebrand-history-rewrite-backup:TRADEMARK.md > /tmp/trademark.before
git show HEAD:TRADEMARK.md > /tmp/trademark.after
diff -q /tmp/trademark.before /tmp/trademark.after  # MUST output nothing

# 2. The upstream source URL in Dockerfile.server must still point at lukilabs/rox-agents-oss.
grep -F 'org.opencontainers.image.source' Dockerfile.server | grep -F 'lukilabs/rox-agents-oss' \
  || { echo "FAIL: upstream attribution URL was rewritten"; exit 1; }
```

If any check fails, **stop, restore from backup, investigate**. Never push a rewritten history that has scrubbed Apache 2.0 attribution.

### Force-push procedure

```bash
# 1. Force-push main.
git -C . push --force-with-lease origin main

# 2. Force-push the rebrand-v1 tag (it now points at a different SHA after the rewrite).
git -C . push --force origin refs/tags/rebrand-v1

# 3. Push the new SHAs of every still-relevant branch.
#    By this point only `main` and the backup branch should exist;
#    every other branch should have been merged or closed in the prerequisites step.
git -C . branch -r | grep -v 'HEAD\|main\|pre-rebrand\|backup/' | while read remote; do
  echo "Stale remote ref: $remote — review manually before deletion"
done
```

`--force-with-lease` is mandatory (not plain `--force`) so the push fails closed if anyone else pushed to `main` in the time between the backup and the rewrite.

### Post-rewrite re-coordination protocol

After the force-push, every clone in the world (including codex's local checkout and any developer machines) is on stale ancestry. Each must run:

```bash
git fetch origin --prune
git switch main
git reset --hard origin/main
# Any locally-committed work that hasn't been pushed: cherry-pick onto the new main.
```

Document this in `README.md` § "After R.11 history rewrite" with a 72-hour visible banner.

### New ticket

- `T298-rebrand-git-history-rewrite` — the closeout ticket; the worklog records every command run, every backup created, every legal-preserve diff that passed, and the pre/post `git rev-list --count main` numbers.

### Validation

- All three legal-preserve byte-diffs are empty.
- The Dockerfile attribution URL grep passes.
- `bun run validate:rebrand` is green on the rewritten history.
- `bun run typecheck`, full `bun test`, `bun run build` are all green on the rewritten history.
- `git log --oneline | wc -l` shows the expected post-rewrite commit count (filter-repo may compact some commits; document the delta).

### Stopping condition

- Backup tag and backup mirror both exist.
- Force-push completed without rejection.
- Legal-preserve diffs are empty.
- T298 `Status: DONE`.

### Rollback (if R.11 goes wrong)

```bash
# 1. Restore main from backup tag.
git -C . switch main
git -C . reset --hard pre-rebrand-history-rewrite-backup
git -C . push --force origin main

# 2. Force-push the rebrand-v1 tag back to its pre-rewrite SHA (read from the backup mirror).
cd /tmp/rox-one-terminal-backup-2026-05-13.git
ORIG_REBRAND_SHA=$(git rev-parse rebrand-v1)
cd /home/dev/rox/rox-one-terminal
git tag -f rebrand-v1 "$ORIG_REBRAND_SHA"
git push --force origin refs/tags/rebrand-v1
```

After rollback, R.11 is marked `Status: ROLLED-BACK` in its ticket and a new ticket is authored to investigate the cause before another attempt.

---

# Global stopping condition

All of:

1. T260–T298 `Status: DONE` with matching worklogs and commit SHAs (T298 is the R.11 git-history-rewrite closeout).
2. `bun run validate:rebrand` green on `main`.
3. `bun run typecheck`, full `bun test`, `bun run lint`, `bun run build`, `bun run validate:docs`, `bun run validate:agent-contract` all green on `main`.
4. The master roadmap's Phase 2 (RBAC) has merged and is on the rewritten ancestry — i.e. R.11 ran *after* RBAC closeout, so RBAC commits live on the cleaned history rather than the legacy one.
5. `rebrand-v1` tag exists on `main` (re-pointed to the post-rewrite SHA in Phase R.11).
6. `pre-rebrand-history-rewrite-backup` tag exists on `origin` and the offline mirror at `/tmp/rox-one-terminal-backup-2026-05-13.git` is preserved for at least 90 days.
7. `docs/release/rebrand-mapping-2026-05-13.md` is updated with closeout commit SHAs.
8. `git log -p --all` shows zero matches for the forbidden-token list outside the legal-preserve allowlist.

# Stop and ask if

- The C.4 follow-on closeout (`T223-c4-followups-closeout`) is not yet `Status: DONE` when you start Phase R.5 — package-scope renames will collide with active C.4 import-path changes.
- A legal-preserve allowlist entry is ambiguous — Apache 2.0 attribution boundaries are non-negotiable, ask before editing.
- Phase R.5 finds an unexpected package scope (e.g. a third-party fork shipping `@rox-agent/*` under a different license) — the rebrand must not break legitimate downstream users without notice.
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
- After Phase R.5 (package scope rename) lands, the master roadmap's Phase 2 (RBAC) and beyond will reference `@rox-one/*` instead of `@rox-agent/*`. Update the master roadmap's "Read first" lists in a single follow-up commit to reflect the new scope.
- Phase R.7's Docker rebuild may invalidate cached CI artifacts; expect a one-time slower CI run after R.7 lands.

# The `/goal` invocation (single short line to paste into Codex)

```
/goal follow the instructions in docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md
```

That line is 102 characters — well under codex's 4 000-char limit.
