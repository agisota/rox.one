# T000 - Bootstrap agent operating system

## Task summary

Bootstrapped repo-local operating contract for the Agent Workbench Suite backlog.

## Repo context discovered

The root package is `craft-agent` version `0.8.12`, uses Bun workspaces, and already has package scripts for tests, typechecks, Electron builds, WebUI builds, marketing builds, i18n parity, and CI validation.

## Files inspected

- `package.json`
- shallow root structure for `docs`, `scripts`, `.github`, `.agents`, and `AGENTS.md`

## Tests added first

Added `scripts/validate-agent-contract.ts` before creating the required contract files.

## Expected failing test output

```text
[agent-contract] missing required file: AGENTS.md
```

## Implementation changes

- Added repo-local `AGENTS.md` for Agent Workbench task execution rules.
- Added 11 project skills under `.agents/skills/*/SKILL.md`.
- Added ticket, worklog, and validation documentation scaffolding.
- Added T000-T040 ticket placeholders plus `docs/tickets/TEMPLATE.md`.
- Added `scripts/validate-agent-contract.ts`.
- Added package scripts `validate:agent-contract` and `validate:docs`.

## Validation commands run

```sh
bun run scripts/validate-agent-contract.ts
bun run validate:agent-contract
bun run validate:docs
```

## Passing test output summary

`bun run validate:agent-contract` and `bun run validate:docs` passed with `[agent-contract] ok: 11 skills, 41 tickets, 7 required docs`.

## Build output summary

No application build required for T000 because only documentation, skills, and validation scaffolding were added.

## Remaining risks

- T000 establishes the process layer only; it does not implement product UI or cloud behavior.
- Existing unrelated runtime files `events.jsonl` and `.omx/` are intentionally outside this task.

## Acceptance criteria matrix

| Criterion | Status |
| --- | --- |
| `AGENTS.md` exists | Done |
| All skills have valid `SKILL.md` | Done |
| Docs directories exist | Done |
| Baseline validation commands documented | Done |
| Validation script added | Done |
| Validation script passes | Done |
| Worklog created | Done |
