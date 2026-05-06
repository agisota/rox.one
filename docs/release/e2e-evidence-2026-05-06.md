# ROX ONE Agent Workbench Suite - E2E Evidence 2026-05-06

Branch: `mac/rox-production-ready-rc`
Scope: fake-provider-safe local RC evidence.

## 1. Covered Journey

The integrated journey is represented by
`packages/shared/src/workbench/experience-layer-e2e-scenario.ts` and validated
through:

```bash
bun run validate:e2e-core-scenarios
bun run e2e:core
```

## 2. Journey Steps

```text
1. User enters raw prompt
2. User rewrites prompt
3. Quest advances
4. User builds spec
5. Execution Readiness increases
6. User creates TDD plan
7. User runs Review Gate
8. Review warning creates blocker/risk signal
9. User drafts 24h mission
10. User launches fake-provider mission
11. Mission appears in Mission Control projection
12. Checkpoint produces artifact/evidence
13. VDI updates only after evidence/gate pass
14. User opens Arena projection
15. Trusted agents are selected
16. Swarm branch is drafted
17. Swarm signals are deduped
18. User opens Progress projection
19. VDI/Quality/Readiness reflect journey
20. User opens Quest Map projection
21. Completed quests show evidence
22. User opens Forge projection
23. Trusted package install/fork works
24. Final deliverable is verified
```

## 3. Experience Event Sequence

```text
prompt.submitted
  -> prompt.rewritten
  -> spec.compiled
  -> tdd.plan.created
  -> review.completed
  -> gate.warned
  -> mission.drafted
  -> mission.launched
  -> mission.checkpoint.completed
  -> artifact.created
  -> gate.passed
  -> quest.completed
  -> agent.package.installed
  -> agent.package.forked
  -> mission.finalized
```

## 4. Mission Launch Evidence

```text
Deep Missions form
  -> mission.drafted
  -> mission.launched
  -> scheduler seam
  -> Mission Control projection
  -> checkpoint evidence
  -> final artifact and passing gate
```

## 5. Provider Gateway Evidence

```text
MissionModePromptRegistry
  -> prompt contract compile
  -> fake provider output
  -> schema validation
  -> malformed output fails
  -> timeout does not corrupt mission state
  -> secret redaction before public/share output
```

## 6. Share Evidence

```text
Session share
  -> redacted bundle
  -> fake ShareProvider.uploadBundle()
  -> fake ShareProvider.createShortlink()
  -> fake ShareProvider.getShareStatus()
  -> revoke
```

## 7. Account Evidence

```text
ROX ID
  -> registration pending is not authenticated success
  -> login success requires confirmed session
  -> auth_required is actionable
  -> logout clears session
  -> raw IPC text is not shown to user
```

## 8. Final Command Evidence

```bash
bun run validate:docs
bun run validate:agent-contract
bun run typecheck:all
bun test
bun run lint
bun run electron:build
bun run validate:ci
bun run validate:e2e-core-scenarios
bun run e2e:core
bun run electron:smoke
bun run validate:mac-arm-build-workflow
git diff --check
```

Result:

- `bun run validate:docs`: passed.
- `bun run validate:agent-contract`: passed; 11 skills, 88 tickets, 7 required
  docs.
- `bun run typecheck:all`: passed.
- `bun test`: passed; 4708 pass, 13 skip, 0 fail, 1 snapshot.
- `bun run lint`: passed with 0 errors and 3 existing React hook warnings.
- `bun run electron:build`: passed; Vite chunk-size warnings only.
- `bun run validate:ci`: passed.
- `bun run validate:e2e-core-scenarios`: passed.
- `bun run e2e:core`: passed; 5 core scenarios passed with fake providers.
- `bun run electron:smoke`: passed; headless app startup reached ready markers.
- `bun run validate:mac-arm-build-workflow`: passed.
- `git diff --check`: passed.
