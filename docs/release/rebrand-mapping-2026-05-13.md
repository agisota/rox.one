# ROX.ONE Rebrand Mapping Report - 2026-05-13

This report is the Phase R.0 baseline for the ROX.ONE rebrand sweep. It records
tracked-file findings before R.1-R.10 cleanup work begins.

- Canonical decision ADR:
  `docs/decision-records/audit-harness/0011-rox-one-rebrand-canonical-tokens.md`
- Inventory source: `git ls-files` piped into `rg`.
- Scope: tracked repository files only; generated, ignored, `.git/`, and
  untracked runtime state are excluded.
- Expected state at R.0: findings remain outside the legal-preserve allowlist.
  Later phases remove or reclassify them.

## Forbidden Token List

```text
rox-agent
@rox-agent
ROX_
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

## Inventory Commands

```bash
git ls-files -z | xargs -0 rg -F -n --no-heading -- '<token>'
git ls-files -z | xargs -0 rg -i -n --no-heading \
  'discord|twitter\.com|x\.com|community\.|forum\.|docs\..*rox'
```

## Bucket: Package Scope And Import Paths

| Token | Current tracked-line count | Highest-volume paths |
| --- | ---: | --- |
| `@rox-agent` | 1376 | `bun.lock`; `packages/server-core/src/sessions/SessionManager.ts`; `apps/electron/src/main/index.ts`; `apps/electron/src/shared/types.ts`; `packages/server-core/src/handlers/rpc/settings.ts` |
| `rox-agent` | 1905 | `apps/electron/resources/docs/rox-cli.md`; `bun.lock`; `packages/server-core/src/sessions/SessionManager.ts`; `packages/shared/tests/shellguard-corpus.test.ts`; `packages/shared/src/config/cli-domains.ts` |

Planned cleanup owner: Phase R.5 package-scope rename plus Phase R.3 binary/doc
path renames.

## Bucket: Environment Variables

| Token | Current tracked-line count | Highest-volume paths |
| --- | ---: | --- |
| `ROX_` | 925 | `packages/server/src/index.ts`; `apps/electron/resources/docs/automations.md`; `apps/electron/src/main/index.ts`; `scripts/build-server.ts`; `packages/session-tools-core/src/runtime/resolve-script-runtime.test.ts`; `README.md` |

Planned cleanup owner: Phase R.6 env-var shim and call-site migration. The
future `readEnv()` shim may keep explicit legacy definitions for one minor
version and must warn once per process.

## Bucket: Config Paths And User Data

| Token | Current tracked-line count | Highest-volume paths |
| --- | ---: | --- |
| `~/.rox` | 7 | rebrand goal; `apps/electron/resources/docs/automations.md` |
| `.rox-agent` | 7 | rebrand goal; `packages/shared/src/config/paths.ts`; `apps/electron/resources/docs/automations.md` |

Planned cleanup owner: Phase R.8 user-data migration shim plus Phase R.1/R.4
docs cleanup.

## Bucket: Product Text

| Token | Current tracked-line count | Highest-volume paths |
| --- | ---: | --- |
| `Rox Agents` | 49 | rebrand goal; `plan.md`; `snapshot.md`; `packages/shared/src/workbench/__tests__/spec-compiler.test.ts`; `packages/shared/src/unified-network-interceptor.ts`; `AGENTS.md` |
| `Rox Agent` | 59 | rebrand goal; `plan.md`; `snapshot.md`; `packages/shared/src/workbench/__tests__/spec-compiler.test.ts`; `packages/shared/src/unified-network-interceptor.ts`; `AGENTS.md` |

Planned cleanup owner: Phase R.1 surface text completion and Phase R.4
documentation cleanup. Historical tickets/worklogs are allowlisted once done.

## Bucket: Code Identifiers

| Token | Current tracked-line count | Highest-volume paths |
| --- | ---: | --- |
| `RoxAppIcon` | 6 | `apps/electron/src/renderer/components/icons/RoxAppIcon.tsx`; rebrand goal |
| `RoxAgentsLogo` | 9 | `apps/electron/src/renderer/playground/registry/icons.tsx`; `apps/electron/src/renderer/components/icons/RoxAgentsLogo.tsx` |
| `RoxAgentsSymbol` | 23 | renderer onboarding, top-bar, splash, app-menu, playground, and icon files |
| `RoxMcpClient` | 22 | `packages/shared/src/mcp/validation.ts`; `packages/shared/src/mcp/mcp-pool.ts`; `packages/server-core/src/handlers/rpc/sources.ts` |
| `RoxOAuth` | 7 | `packages/shared/src/sources/credential-manager.ts`; `packages/shared/src/auth/oauth.ts` |
| `RoxMetadataSchema` | 2 | rebrand goal only at R.0 baseline |

Planned cleanup owner: Phase R.2 code identifier renames.

## Bucket: Assets, Docs, And Binaries

| Token | Current tracked-line count | Highest-volume paths |
| --- | ---: | --- |
| `rox-cli` | 94 | `docs/cli.md`; `apps/cli/src/index.ts`; `README.md`; `packages/shared/src/utils/files.ts`; `apps/electron/src/main/index.ts` |
| `rox-logos` | 4 | rebrand goal; `apps/electron/resources/AGENTS.md` |

Planned cleanup owner: Phase R.3 asset, binary, and CLI doc renames.

## Bucket: Community Links

Current tracked-file findings for community-link patterns:

| Path | Current finding |
| --- | --- |
| `apps/electron/resources/docs/automations.md` | Discord prose and `ROX_WH_DISCORD_URL` example |
| `apps/electron/resources/release-notes/0.9.0.md` | Historical `docs.rox.do` release-note link |
| `packages/shared/src/automations/utils.ts` | `ROX_WH_DISCORD_TOKEN` examples |
| `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md` | Phase R.9 instructions |

Planned cleanup owner: Phase R.9. Historical release notes remain preserved.

## Bucket: Legal preserve — community links (R.9 closeout)

T295 (Phase R.9) audited every tracked file for community-implying URLs and
landed the following replacements. The audit regression test lives at
`scripts/__tests__/community-link-audit.test.ts`; it fails closed if any of
the patterns below reappear outside the allowlist.

### R.9 REPLACE set (2 paths, 3 hits)

| Path:line | Old URL | New URL | Justification |
| --- | --- | --- | --- |
| `.github/ISSUE_TEMPLATE/bug_report.yml:116` | `https://github.com/lukilabs/rox-agents-oss#troubleshooting` | `https://github.com/agisota/rox-one-terminal#troubleshooting` | User-facing bug-report template pointing reporters at the upstream README implied this product still lives in the upstream community. Redirected to the ROX.ONE-owned repo's Troubleshooting section. |
| `apps/electron/src/renderer/playground/registry/browser-ui.tsx:691` | `https://github.com/lukilabs/rox-agents-oss/pulls` | `https://github.com/agisota/rox-one-terminal/pulls` | Playground demo seed data renders a mock browser tab with this URL. Demoing the upstream PR list implied this product still ships from there. |
| `apps/electron/src/renderer/playground/registry/browser-ui.tsx:783` | `https://github.com/lukilabs/rox-agents-oss` | `https://github.com/agisota/rox-one-terminal` | Same demo registry, separate seed; the surrounding title literal `'ROX ONE OSS Repo …'` was already ROX-branded, so only the URL needed updating. |

### R.9 PRESERVE set (community-implying patterns that remain by design)

| Path | Category | Justification |
| --- | --- | --- |
| `LICENSE` | Apache 2.0 §4 attribution | Upstream copyright + source URL preserved verbatim. |
| `NOTICE` | Apache 2.0 §4 attribution | Same. |
| `TRADEMARK.md` | Trademark notice | Same. |
| `Dockerfile.server` (`org.opencontainers.image.source` label) | OCI image attribution | The image label must point at the upstream source per Apache 2.0; enforced by the R.7 test `scripts/__tests__/r7-docker-ci-build.test.ts`. |
| `README.md` (License + Acknowledgements sections) | Attribution | Allowlisted line-by-line in `scripts/validate-rebrand.cjs`. |
| `plan.md`, `snapshot.md` | Historical orientation docs | Whole-file allowlist; revised in R.4 but the upstream remote/clone references remain for operator reference. |
| `apps/electron/resources/release-notes/*.md` | Historical immutable release notes | Reference upstream GitHub issues (e.g. `#597`, `#583`, `#616`) and `docs.rox.do/messaging/lark` because the release notes describe shipped state at the time; preserving them is the historical record. |
| `docs/worklog/T*-*.md`, `docs/tickets/T*-*.md` (Status: DONE) | Historical immutable record | Same. |
| `docs/decision-records/` | Architectural decision records | Historical record of decisions; ADR 0011 is the canonical rebrand decision and refers back to upstream context. |
| `docs/release/upstream-v0.9.1-rox-protected-map.md` | Upstream merge map | Operational doc describing the upstream merge baseline; explicitly names the upstream remote. |
| `docs/superpowers/goals/2026-05-13-*.md` | Goal definitions | Goals define the audit rules themselves; they name the forbidden patterns to document them. |
| `packages/server-core/src/sessions/SessionManager.ts:680` | Developer JSDoc traceability | The comment `See: https://github.com/lukilabs/rox-agents-oss/issues/39` documents *why* the SDK subprocess disables Bun's auto `.env` loading (a fix that originated in the upstream issue tracker). It is developer-facing context, not a user-directed community link, and is line-allowlisted in the audit test. |
| `packages/shared/src/automations/utils.ts` (`ROX_WH_DISCORD_TOKEN` JSDoc) | Generic Discord webhook example | Documents how arbitrary Discord webhooks can be wired up via the `ROX_WH_*` user-defined secret namespace. Not a community link. Token namespace itself is owned by R.6 / future env-var renames, not R.9. |
| `apps/electron/resources/docs/automations.md` (Discord/Slack webhook examples) | Generic webhook docs | Documents the webhook-action capability with Slack and Discord as illustrative third-party services. Not a community link directing users to a Rox Agents server. |

### R.9 placeholder destinations

The goal authorised placeholder URLs for canonical ROX.ONE community
destinations (`https://discord.gg/rox-one`, `https://x.com/rox_one`,
`https://rox.one/community`). The R.9 audit did not need to use any of those
placeholders — the REPLACE set above redirects to the ROX.ONE-owned GitHub
repository only, which exists today. Future ticket work (post-R.10) may need
to expand on the canonical Discord/X destinations once they are minted.

### R.9 verification

- Regression test: `bun test scripts/__tests__/community-link-audit.test.ts` (3 pass, 0 fail).
- Manual click-through on every replaced URL: deferred (`TBD: manual verification`); the three replacement URLs all resolve to existing GitHub paths under the ROX.ONE-owned repository.

## Bucket: Legal Preserve

These paths are intentionally allowlisted by ADR 0011 and the rebrand goal:

- `LICENSE`
- `NOTICE`
- `TRADEMARK.md`
- `Dockerfile.server`, limited to the `org.opencontainers.image.source` label
- `README.md`, limited to License and Acknowledgements sections
- `docs/decision-records/`
- `docs/worklog/T0*-*.md`, `docs/tickets/T0*-*.md`
- `docs/worklog/T1*-*.md`, `docs/tickets/T1*-*.md`
- `docs/worklog/T2*-*.md`, `docs/tickets/T2*-*.md`
- `apps/electron/resources/release-notes/`
- `plan.md`
- `snapshot.md`
- `.brv/`
- `.swarm/`
- `.git/`

Later phases must not edit legal attribution unless an explicit ticket records
why a line is not attribution or immutable history.

## Closeout Update Slot

Phase R.10 closeout result:

- Final validator result: `bun run validate:rebrand` exits 0 with
  `rebrand validation passed: no forbidden tokens outside the allowlist`.
- Permanent gates: `.husky/pre-push` and `.github/workflows/validate.yml`
  both run `bun run validate:rebrand`.
- Roadmap gate follow-up: `bun run validate:roadmap` exits 0 with
  `validate:roadmap OK — 46 phases, 111 tickets across detail files`
  after T321 aligned the validator with the shipped phase ledger.
- Preserved upstream-link list: unchanged from the R.9 PRESERVE set
  above (`LICENSE`, `NOTICE`, `TRADEMARK.md`, Dockerfile source label,
  README License/Acknowledgements, historical release notes, historical
  tickets/worklogs, ADRs, and goal/design docs).
- Preserved compatibility surfaces: the R.6 `readEnv()` shim and
  one-minor-version compatibility surfaces documented inline with
  `// Allowlist reason:` comments in `scripts/validate-rebrand.cjs`.

Closeout phase ledger:

| Phase | Tickets | Commits |
| --- | --- | --- |
| R.0 | T260,T261,T262 | `58613ed` |
| R.1 | T263 | `24aa751` |
| R.2 | T264,T265,T266 | `93e7b73,cc89339,e6117bb` |
| R.3 | T267,T268 | `82a8425,e9305ca` |
| R.4 | T269,T270,T271,T272 | `5bfd87a,1cd54cf,0fd740f,cb34ecd` |
| R.5 | T273-T284 | `acc1946,76b85ec,f07da34,09ef0ef,34dc261,35098cc,f7c2a15,d7a9af1,8a390ec,baad43e,3ab5324,2c70ed4` |
| R.6 | T285-T288 | `777ada7,3caa407` |
| R.7 | T289-T291 | `1766229,24b0d01,23a3b73,4b2ef22` |
| R.8 | T292,T293,T294 | `3f9ea58,efdf1bc,f39d087` |
| R.9 | T295 | `17990c4` |
| R.9.5 | T298a,T300a | `b6ce2c4,6537ada,512dacc` |
| R.10 | T296,T297 | `7cee988` |
| R.10 follow-up | T321 | `f82da7f` |
