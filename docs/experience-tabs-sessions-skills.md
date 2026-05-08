# ROX Experience tabs — sessions/skills/product map

Status: local product note for the Electron Experience surface.
Scope: sanitized demo/runtime wiring only; no credentials, tokens, local absolute paths, cookies, auth headers, or private raw transcripts.

## Source of truth

```
sanitized local sessions / skills / build evidence
        │
        ▼
ExperienceTruthState
  - mission
  - checkpoints
  - gateResults
  - metricSnapshots
  - questProgress
  - ledger
  - agentPackages
  - installedAgentPackageIds
        │
        ├─ Долгие миссии        → createDeepMissionEntryStateFromTruth
        ├─ Арена агентов        → createArenaBuilderStateFromTruth
        ├─ Центр миссий         → createMissionControlStateFromTruth
        ├─ Прогресс             → createProgressionStateFromTruth
        ├─ Карта квестов        → createQuestMapStateFromTruth
        └─ Кузница агентов      → createAgentForgeStateFromTruth
```

Canonical code surfaces:

| Layer | File | Role |
|---|---|---|
| Shared schema | `packages/shared/src/workbench/experience-layer.ts` | Zod schemas for missions, checkpoints, agent packages, quests, ledger, metrics |
| Truth state | `packages/shared/src/workbench/experience-state.ts` | Validates and projects immutable `ExperienceTruthState` |
| Runtime events | `packages/shared/src/workbench/experience-runtime-store.ts` | Replays events into active mission/runtime projection |
| Quest projection | `packages/shared/src/workbench/experience-quest-engine.ts` | Quest unlock/progress logic |
| Demo sessions | `apps/electron/src/renderer/components/workbench/demo-experience-sessions.ts` | 30 sanitized demo sessions: 5 per Experience tab |
| Route binding | `apps/electron/src/renderer/components/workbench/WorkbenchRoutePage.tsx` | Per-tab demo session switcher + truth-state injection |
| Route tests | `apps/electron/src/renderer/components/workbench/__tests__/workbench-route-page.test.tsx` | Guards tab renderability and exactly 5 demos per tab |

## Product roles

| Tab | Product role | Primary input | Primary output | Skill/session link |
|---|---|---|---|---|
| Долгие миссии | Configure long autonomous runs with budget, time, checkpoints, VDI target | `mission`, selected `agentPackages`, limits | Launch-ready mission draft/checkpoint plan | Converts session intent into a bounded agent mission |
| Арена агентов | Compare agents or skill packs on the same mission | `agentPackages`, `mission`, metric snapshots | Agent roster, run estimate, relative quality/cost view | Turns skills into competing/evaluable runs |
| Центр миссий | Operate live mission execution and approvals | `mission`, `checkpoints`, `gateResults` | Runtime feed, approval state, artifacts, audit trail | Session timeline/agent outputs become mission evidence |
| Прогресс | Show evidence-backed progress, XP, readiness and VDI | `metricSnapshots`, `ledger`, gates | User/team readiness and reward ledger | Only verified artifacts/gates produce progression value |
| Карта квестов | Decompose growth into unlockable quests | `questProgress`, evidence refs, layer | Quest lanes, unlock state, completion proof | Skills/sessions unlock capabilities only after evidence |
| Кузница агентов | Package private/team/public agent skills safely | `agentPackages`, contracts, trust checks | Installable/forkable packages with trust/risk state | Skills become managed packages with permissions and validation gates |

## Demo sessions installed

Each tab now has its own local pool of 5 sanitized sessions. They are synthetic but customized from real operator themes: ROX desktop release, Hermes gateways, Obsidian/vault work, Cloudflare/Tailscale ops, pzdrk/browser QA, Modal GPU serving, skills maintenance, private agent packs.

| Tab | Count | Demo IDs |
|---|---:|---|
| Долгие миссии | 5 | `deep-rox-production-rc`, `deep-hermes-gateway-recovery`, `deep-obsidian-vault-index`, `deep-cloudflare-zone-audit`, `deep-tailscale-health-watch` |
| Арена агентов | 5 | `arena-naming-regression-battle`, `arena-pzdrk-extension-fix`, `arena-kimi-modal-serving`, `arena-skill-pack-review`, `arena-ui-redesign-shotgun` |
| Центр миссий | 5 | `mission-packaged-smoke-run`, `mission-s3-artifact-handoff`, `mission-api-model-visibility`, `mission-db-backup-validation`, `mission-agentbook-rc` |
| Прогресс | 5 | `progress-release-ledger-backfill`, `progress-hermes-ops-streak`, `progress-research-citations`, `progress-skill-maintenance`, `progress-infra-risk-burn-down` |
| Карта квестов | 5 | `quest-ship-rox-desktop`, `quest-import-agent-memory`, `quest-ai-cloud-stack`, `quest-secure-ops-foundation`, `quest-public-content-engine` |
| Кузница агентов | 5 | `forge-private-rox-pack`, `forge-hermes-stt-ops`, `forge-modal-gpu-servant`, `forge-cloudflare-auditor`, `forge-obsidian-librarian` |

## How tabs connect

```
Долгие миссии
  └─ defines mission objective, budget, gates, selected agent package
       ▼
Арена агентов
  └─ compares candidate agents/skills for the mission
       ▼
Центр миссий
  └─ runs/observes the selected mission and captures checkpoints/evidence
       ▼
Прогресс
  └─ converts verified evidence into VDI, readiness, XP, risk burn-down
       ▼
Карта квестов
  └─ shows what capabilities this evidence unlocks next
       ▼
Кузница агентов
  └─ packages the repeated working pattern as a private/team agent package
       └────────────── feeds back into Долгие миссии / Арена агентов
```

## API/backend/model visibility

Code truth as of this note:

| Area | Current behavior |
|---|---|
| Provider types | `anthropic`, `pi`, `pi_compat` |
| Auth types | `api_key`, `api_key_with_endpoint`, `oauth`, `iam_credentials`, `bearer_token`, `service_account_file`, `environment`, `none` |
| Onboarding options | Anthropic API key, Claude OAuth, Pi ChatGPT OAuth, Pi Copilot OAuth, Pi API key |
| Pi model source | `@mariozechner/pi-ai` via `getProviders()` / `getModels()` in `packages/shared/src/config/models-pi.ts` |
| Current local catalog size | 25 Pi API-key providers, 920 Pi-backed model entries in the installed SDK catalog |
| Hidden/filtered models | `gemini-1.5-*`, `gemini-2.0-*`, `codex-mini-latest`, and `gpt-4*` prefixes are excluded by local filters |
| Pre-login availability | UI can render onboarding/settings/demo Experience state; real LLM execution requires a configured connection/session credential |
| Backend status | Local/private RC. Public hosted provider/workers/persistence are not proven production-ready by this local wiring alone |

Important distinction: model names visible from the Pi SDK catalog are not the same as a guaranteed usable account entitlement. Runtime availability still depends on the selected auth method, provider key/OAuth/session, endpoint, and current upstream provider support.

## Import policy for real Rox sessions/skills

Allowed:
- session titles, timestamps, sanitized objectives;
- artifact IDs that do not expose local paths or secret-bearing filenames;
- validation result status (`pass|warn|fail`) and evidence labels;
- skill names/descriptions after secret/path redaction;
- aggregate metrics: VDI, quality, readiness, risk, cost.

Blocked:
- API keys, tokens, passwords, cookies, SSH material, `.env` contents;
- raw prompts containing credentials or private customer data;
- absolute local paths unless converted to neutral artifact IDs;
- connection strings and auth headers;
- mutable runtime DB state as canonical source.

Recommended importer shape:

```
Rox session row/log/skill file
  → redact secrets + path normalize
  → infer mission/checkpoints/gates/metrics
  → validate with ExperienceTruthStateSchema
  → write demo/import bundle
  → render all Experience tabs from the same truth state
```

## Current import stance

The current change does not bulk-import raw Rox Agents sessions. It installs a safe demo layer first. A real importer should be a separate explicit step with:

1. source discovery (`~/.rox`, workspace folders, skill directories, session DB/log files);
2. secret scanner/redactor;
3. schema validator;
4. dry-run diff;
5. isolated import bundle under an artifact directory, not direct mutation of live app state.
