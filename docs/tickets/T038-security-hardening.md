# T038-security-hardening

Status: DONE

## Goal

Run a focused security hardening pass over the implemented Experience Layer and Agent Forge surfaces.

## Required Scope

- Public Agent Forge publish must require package contract, reviewer evidence, passing test evidence, prompt-injection scan clearance, and a minimum trust score.
- Private user-owned agent packages must not be visible to other users just because they share the same team.
- Keep paid entitlements capacity-only: they must not satisfy validation gates or quality metrics.
- Preserve existing team/private registry behavior unless it violates the shared truth and trust model.

## Required Tests

- Shared security guard tests for public publish trust requirements.
- Agent Forge state tests for public publish denial and private owner visibility isolation.
- Existing Experience Layer security tests must stay green.
- Team chat HTTP routes must reject workspace IDs and workspace refs outside the current team when the managed cloud workspace store is configured.
- Team invite HTTP routes must reject invalid runtime roles, including `owner` and unknown role names.

## Validation Commands

- `bun test packages/shared/src/workbench/__tests__/experience-layer-security.test.ts apps/electron/src/renderer/components/workbench/__tests__/agent-forge-team-registry.test.tsx`
- `bun run typecheck:shared`
- `bun run typecheck:electron`
- `bun run lint:electron`
- `bun run validate:agent-contract`
- `bun run electron:smoke`
- `bun audit`

## Acceptance Criteria

- [x] Public package publish cannot bypass contract/review/test/trust requirements.
- [x] Prompt injection warnings still block public publish.
- [x] Private user-owned packages are visible only to their owner.
- [x] Team package visibility remains tenant-scoped.
- [x] Team chat workspace/ref spoofing is denied when cloud workspace store exists.
- [x] Invalid team invite roles are denied at runtime.
- [x] Tests pass.
- [x] Relevant typecheck/lint/smoke validation passes.
- [x] Worklog complete.
- [x] Scoped Lore commit exists.
