# T538 - DeepWiki indexed knowledge workflow

Status: DONE

## Problem

DeepWiki indexing for `https://deepwiki.com/agisota/rox.one` completed after the original Graphify artifact pass. Agents need durable local copies of the DeepWiki results and a consistent workflow that explains how to combine DeepWiki, Graphify, source inspection, tickets/worklogs, and validation checks.

## Scope

- Save the indexed DeepWiki structure, full contents, split pages, and selected `ask_question` captures locally.
- Update `AGENTS.md` so agents can discover the local Graphify and DeepWiki artifacts.
- Add architecture documentation with exact artifact paths, usage rules, query patterns, debugging flow, validation flow, and freshness rules.
- Add `.devin/wiki.json` to steer future DeepWiki regeneration.
- Keep product runtime code unchanged.

## Acceptance Criteria

- [x] DeepWiki `read_wiki_structure` is saved locally.
- [x] DeepWiki `read_wiki_contents` is saved locally and split into focused page files.
- [x] Representative DeepWiki `ask_question` answers are saved locally.
- [x] `AGENTS.md` links to the local DeepWiki and Graphify workflow.
- [x] A durable architecture doc explains how agents should use Graphify, DeepWiki, source inspection, and validation together.
- [x] `.devin/wiki.json` exists and parses as JSON.
- [x] No product runtime code is changed by this task.
