# T078 - Agent Arena + Agent Forge Real Actions

Status: DONE

## Goal

Make agent install, fork, Arena selection, and agent mastery read from Experience runtime truth instead of isolated component state.

## Scope

- Runtime install/fork guards for trusted agent packages.
- Evidence-backed install and fork progression events.
- Arena roster projection from installed runtime packages.
- Verified usage mastery projection from runtime ledger evidence.
- Keep existing tenant visibility, locked agent, and public-publish guards intact.

## Acceptance

- Packages without trust evidence cannot install through runtime events.
- Forking requires evidence and trusted package state.
- Installed runtime packages appear in the Arena roster.
- Verified usage increases agent mastery; paid/capacity state does not.
- Arena draft keeps selected trusted agents and required gates.
- Tests and validation are recorded in `docs/worklog/T078-agent-arena-forge-real-actions.md`.
