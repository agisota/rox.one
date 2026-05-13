# T300a - AGENTS.md voice + builtin-sources alias

## Context

We are building a white-label fork of Rox Agents OSS into Agent Workbench Suite.

R.9.5 closes the last unambiguous runtime literal-text misses outside
the shim-preservation allowlist. Two surfaces remain after T298a +
T299a:

1. `AGENTS.md` — the operating contract still frames the project as
   "Rox Agents OSS" in its opening sentence and rule 9. The
   canonical voice is "ROX.ONE Agent Workbench Suite"; the historical
   "originally forked from Rox Agents OSS" reference is preserved
   only where Apache 2.0 §4 attribution requires it.
2. `packages/shared/src/sources/builtin-sources.ts` — declares a
   built-in source entry with id `builtin-rox-agents-docs` and slug
   `rox-agents-docs`. The slug is preserved as a historical alias
   for one minor version (existing user workspaces that pinned the
   slug continue to work), and a NEW canonical entry
   `builtin-rox-one-docs` is added alongside it.

Relevant product goals (unchanged from TEMPLATE.md):

- local desktop app
- managed web/cloud app
- user/team workspaces
- prompt modes
- multi-agent workflows
- validation gates
- TDD-first implementation

## Goal

`AGENTS.md`'s opening paragraph reads as a ROX.ONE-canonical
operating contract. `builtin-sources.ts` exposes both the new
`builtin-rox-one-docs` id (canonical) and the legacy
`builtin-rox-agents-docs` id (historical alias), with a code
comment documenting the deprecation timeline.

`bun run validate:rebrand` no longer flags either file outside the
explicit per-line allowlist set up in T298a.

## Required UI

None.

## Required Data/API

`builtin-sources.ts` gains a new exported builtin entry. The function
shape stays empty (still returns `[]` in `getBuiltinSources`) because
the docs source is now an always-available MCP server, not a folder
source. The new canonical entry exists for symmetry / discoverability
in code only.

## Required Automations

None.

## Required Subagents

None — narrow text edit on two files.

## TDD Requirements

`bun run validate:rebrand` is the regression gate. Before edits it
reports:

- `AGENTS.md:3` — Rox Agents reference in the opening paragraph.
- `AGENTS.md:15` — "Preserve existing Rox Agents behavior".
- `packages/shared/src/sources/builtin-sources.ts:*` — multiple
  `rox-agents-docs` references.

After edits, only the T298a-allowlisted `rox-agents-docs` alias
lines remain in `builtin-sources.ts`, and `AGENTS.md` has no
findings.

## Implementation Requirements

### AGENTS.md

- Opening paragraph (line 1–3): change the framing from "Codex CLI
  working on a white-label fork of Rox Agents OSS into Agent
  Workbench Suite" to a ROX.ONE-canonical voice. Preserve the
  Apache 2.0 attribution sentence where required.
- Rule 9 (line 15): "Preserve existing Rox Agents behavior unless
  the task explicitly changes it" → "Preserve existing ROX.ONE
  behavior unless the task explicitly changes it."

### packages/shared/src/sources/builtin-sources.ts

- File header comment: rewrite to describe ROX.ONE docs as the
  canonical built-in MCP server, with a note that
  `builtin-rox-agents-docs` is a historical alias preserved for one
  minor version.
- `getDocsSource` JSDoc: replace `rox-agents-docs` framing with
  ROX.ONE docs, keep the deprecation note.
- The literal `id: 'builtin-rox-agents-docs'` + `slug:
  'rox-agents-docs'` in the placeholder remain (per T298a allowlist
  entry); add a one-line comment marking them as deprecated aliases.

## Validation Commands

- `bun run validate:rebrand` — AGENTS.md findings drop; the
  builtin-sources legacy-slug lines remain only via T298a's allowlist.
- `bun run typecheck`
- `bun run lint`
- `git diff --check`

## Acceptance Criteria

- [ ] `AGENTS.md` opening paragraph + rule 9 read as ROX.ONE-canonical.
- [ ] `builtin-sources.ts` header + `getDocsSource` JSDoc framed as
      ROX.ONE docs.
- [ ] Deprecation comment present at the legacy id / slug line.
- [ ] `bun run validate:rebrand` no longer flags AGENTS.md.
- [ ] `bun run typecheck` and `bun run lint` green.
- [ ] Worklog complete.
- [ ] Commit created.

## Worklog

Update `docs/worklog/T300a-rebrand-agents-md-and-misc.md`.
