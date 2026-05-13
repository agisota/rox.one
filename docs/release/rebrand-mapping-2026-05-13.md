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
craft-agent
@craft-agent
CRAFT_
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

## Inventory Commands

```bash
git ls-files -z | xargs -0 rg -F -n --no-heading -- '<token>'
git ls-files -z | xargs -0 rg -i -n --no-heading \
  'discord|twitter\.com|x\.com|community\.|forum\.|docs\..*craft'
```

## Bucket: Package Scope And Import Paths

| Token | Current tracked-line count | Highest-volume paths |
| --- | ---: | --- |
| `@craft-agent` | 1376 | `bun.lock`; `packages/server-core/src/sessions/SessionManager.ts`; `apps/electron/src/main/index.ts`; `apps/electron/src/shared/types.ts`; `packages/server-core/src/handlers/rpc/settings.ts` |
| `craft-agent` | 1905 | `apps/electron/resources/docs/craft-cli.md`; `bun.lock`; `packages/server-core/src/sessions/SessionManager.ts`; `packages/shared/tests/shellguard-corpus.test.ts`; `packages/shared/src/config/cli-domains.ts` |

Planned cleanup owner: Phase R.5 package-scope rename plus Phase R.3 binary/doc
path renames.

## Bucket: Environment Variables

| Token | Current tracked-line count | Highest-volume paths |
| --- | ---: | --- |
| `CRAFT_` | 925 | `packages/server/src/index.ts`; `apps/electron/resources/docs/automations.md`; `apps/electron/src/main/index.ts`; `scripts/build-server.ts`; `packages/session-tools-core/src/runtime/resolve-script-runtime.test.ts`; `README.md` |

Planned cleanup owner: Phase R.6 env-var shim and call-site migration. The
future `readEnv()` shim may keep explicit legacy definitions for one minor
version and must warn once per process.

## Bucket: Config Paths And User Data

| Token | Current tracked-line count | Highest-volume paths |
| --- | ---: | --- |
| `~/.craft` | 7 | rebrand goal; `apps/electron/resources/docs/automations.md` |
| `.craft-agent` | 7 | rebrand goal; `packages/shared/src/config/paths.ts`; `apps/electron/resources/docs/automations.md` |

Planned cleanup owner: Phase R.8 user-data migration shim plus Phase R.1/R.4
docs cleanup.

## Bucket: Product Text

| Token | Current tracked-line count | Highest-volume paths |
| --- | ---: | --- |
| `Craft Agents` | 49 | rebrand goal; `plan.md`; `snapshot.md`; `packages/shared/src/workbench/__tests__/spec-compiler.test.ts`; `packages/shared/src/unified-network-interceptor.ts`; `AGENTS.md` |
| `Craft Agent` | 59 | rebrand goal; `plan.md`; `snapshot.md`; `packages/shared/src/workbench/__tests__/spec-compiler.test.ts`; `packages/shared/src/unified-network-interceptor.ts`; `AGENTS.md` |

Planned cleanup owner: Phase R.1 surface text completion and Phase R.4
documentation cleanup. Historical tickets/worklogs are allowlisted once done.

## Bucket: Code Identifiers

| Token | Current tracked-line count | Highest-volume paths |
| --- | ---: | --- |
| `CraftAppIcon` | 6 | `apps/electron/src/renderer/components/icons/CraftAppIcon.tsx`; rebrand goal |
| `CraftAgentsLogo` | 9 | `apps/electron/src/renderer/playground/registry/icons.tsx`; `apps/electron/src/renderer/components/icons/CraftAgentsLogo.tsx` |
| `CraftAgentsSymbol` | 23 | renderer onboarding, top-bar, splash, app-menu, playground, and icon files |
| `CraftMcpClient` | 22 | `packages/shared/src/mcp/validation.ts`; `packages/shared/src/mcp/mcp-pool.ts`; `packages/server-core/src/handlers/rpc/sources.ts` |
| `CraftOAuth` | 7 | `packages/shared/src/sources/credential-manager.ts`; `packages/shared/src/auth/oauth.ts` |
| `CraftMetadataSchema` | 2 | rebrand goal only at R.0 baseline |

Planned cleanup owner: Phase R.2 code identifier renames.

## Bucket: Assets, Docs, And Binaries

| Token | Current tracked-line count | Highest-volume paths |
| --- | ---: | --- |
| `craft-cli` | 94 | `docs/cli.md`; `apps/cli/src/index.ts`; `README.md`; `packages/shared/src/utils/files.ts`; `apps/electron/src/main/index.ts` |
| `craft-logos` | 4 | rebrand goal; `apps/electron/resources/AGENTS.md` |

Planned cleanup owner: Phase R.3 asset, binary, and CLI doc renames.

## Bucket: Community Links

Current tracked-file findings for community-link patterns:

| Path | Current finding |
| --- | --- |
| `apps/electron/resources/docs/automations.md` | Discord prose and `CRAFT_WH_DISCORD_URL` example |
| `apps/electron/resources/release-notes/0.9.0.md` | Historical `docs.craft.do` release-note link |
| `packages/shared/src/automations/utils.ts` | `CRAFT_WH_DISCORD_TOKEN` examples |
| `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md` | Phase R.9 instructions |

Planned cleanup owner: Phase R.9. Historical release notes remain preserved.

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

Phase R.10 will update this section with final closeout commit SHAs, the
preserved upstream-link list, and the final `validate:rebrand` result.
