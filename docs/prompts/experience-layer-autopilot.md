# Codex Autopilot Prompt - Experience Layer System

Use this prompt inside Codex CLI from the repository root.

```text
You are Codex CLI working in /Users/marklindgreen/Projects/craft/craft.

Mission:
Implement the Experience Layer System described in:
- docs/product/experience-layer-system-prd.md

Operating contract:
- Read AGENTS.md first and follow it exactly.
- Work in Russian-first user-facing summaries, but keep code/API/file names in English.
- Use TDD for every implementation step.
- Do not implement feature code before tests or validation checks.
- Preserve existing Craft/ROX ONE behavior unless the PRD explicitly changes it.
- Do not use real LLM, S3, payment, email, browser, or marketplace providers in tests.
- Use fake deterministic providers for scheduler, LLM outputs, billing, storage, and package registry tests.
- Never bypass validation gates with paid entitlements.
- Never treat elapsed time as mission success.
- Keep Game/Arena presentation separate from the shared truth layer.

Start by doing repo discovery:
1. Inspect package scripts and validation commands.
2. Inspect existing UI route/screen/component patterns.
3. Inspect existing session/workspace/status/label/skill/automation patterns.
4. Inspect existing account/team/storage/ledger/mission-related code if present.
5. Inspect existing test conventions.
6. Record findings in docs/worklog/T041-experience-layer-system.md.

Implementation sequence:
1. T041 - Experience Layer Core Models
2. T042 - Experience Layer Registry
3. T043 - Deep Missions Entry Screen
4. T044 - Arena Builder and Agent Collection
5. T045 - Mission Control Run Detail
6. T046 - Progression Observatory
7. T047 - Quest Map and Skill Tree
8. T048 - Agent Forge and Team Registry
9. T049 - Long-running Mission Scheduler Adapter
10. T050 - Swarm Signal Processor
11. T051 - Experience Layer E2E Scenario
12. T052 - Security and Integrity Pass

For each ticket:
1. Create or update docs/worklog/<TASK>.md.
2. Identify the exact files/modules affected.
3. Write tests first:
   - unit tests for schemas/logic
   - integration tests for stores/services/adapters
   - UI/component tests for screens/components
   - E2E/smoke tests for user-visible flows
   - security/RBAC/entitlement tests where relevant
4. Run the tests and confirm they fail for the expected reason.
5. Implement the smallest change that passes the tests.
6. Run targeted tests.
7. Run relevant broader checks:
   - bun run validate:agent-contract
   - bun test or the relevant test command discovered in package scripts
   - bun run typecheck when TypeScript changed
   - bun run lint when lintable source changed
   - build command only when runtime/build surfaces changed
8. Update the worklog with:
   - files inspected
   - tests added first
   - expected failing output summary
   - implementation changes
   - validation commands and results
   - remaining risks
   - acceptance matrix
9. Commit only scoped files for the current task using the repository Lore commit protocol.
10. Continue to the next ticket only after the current task is green.

Use native Codex subagents only for independent read-only discovery or bounded verification when it materially improves speed or correctness. Suggested subagent lanes:
- UI explorer: routes, shell, composer, screen patterns, component tests.
- Core explorer: schemas, registries, stores, mission/session/workspace patterns.
- Test explorer: test frameworks, fixtures, fake providers.
- Security explorer: team/private registry, permissions, ledgers, entitlements.
- UX verifier: compare implementation against wireframes and PRD screen map.

Definition of done for the full Experience Layer System:
- Command/Game/Arena toggle exists and uses one shared truth model.
- MissionRun and checkpoint models are implemented and tested.
- VDI/submetrics are implemented with deterministic tests.
- Deep Missions, Arena Builder, Mission Control, Progression, Quest Map, and Agent Forge surfaces exist.
- Quest and unlock completion require artifact/gate evidence.
- Paid entitlements increase capacity only, not quality.
- Agent packages require contracts, permissions, and trust checks.
- Long-running mission scheduler fake tests pass.
- Swarm contribution dedupe/scoring tests pass.
- E2E fake mission scenario passes.
- Security tests for tenant isolation, entitlements, package visibility, and ledger spoofing pass.
- Relevant validation commands pass.
- Worklogs are complete.
- Git commits exist for completed tickets.

Forbidden:
- Do not silently skip tests.
- Do not weaken assertions to make tests pass.
- Do not call real external providers in tests.
- Do not stage unrelated dirty files.
- Do not commit generated runtime logs, caches, secrets, or unrelated artifacts.
- Do not implement public marketplace before team/private registry and trust checks exist.
- Do not mark a 24h mission complete just because time elapsed; it must produce pass/warn/fail evidence.

Begin now with T041. Do not stop after planning. Continue through implementation, testing, validation, worklog update, and scoped commit for each ticket until blocked by a real missing authority or destructive action.
```
