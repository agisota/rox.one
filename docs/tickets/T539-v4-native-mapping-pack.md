# T539-v4-native-mapping-pack

Status: DONE

## Goal

Create the ROX.ONE v4 native integration mapping pack that translates the broad product thesis into concrete repo modules, code paths, agent workflow instructions, and PR-sized execution goals.

## Scope

- Document how the v4 ideas map to the current ROX.ONE codebase.
- Document how agents should combine DeepWiki, Graphify, source inspection, tickets/worklogs, and validation commands for v4 work.
- Produce a bounded execution-goals queue for future Codex CLI / Claude Code sessions.
- Keep runtime behavior unchanged.

## Out of scope

- Runtime code changes.
- UI implementation.
- New dependencies.
- Upstream diff closure against the historical source repository; upstream comparison is secondary context for this task.

## Required validation

- `bun run validate:architecture-docs`
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `git diff --check`

## Acceptance criteria

- [x] `docs/architecture/ROX_ONE_V4_NATIVE_MAPPING.md` exists and maps v4 concepts to concrete current files/modules.
- [x] `docs/architecture/ROX_ONE_V4_AGENT_WORKFLOW.md` exists and gives agents detailed instructions for using DeepWiki, Graphify, source inspection, and tests.
- [x] `docs/architecture/ROX_ONE_V4_EXECUTION_GOALS.md` exists and defines PR-sized next goals.
- [x] The mapping explicitly treats DeepWiki/Graphify as navigation evidence, not final proof.
- [x] The mapping explicitly defers always-on voice/screen memory until trust, consent, retention, redaction, and audit are implemented.
- [x] Worklog is complete.
- [x] Required validation passes or blockers are recorded.
