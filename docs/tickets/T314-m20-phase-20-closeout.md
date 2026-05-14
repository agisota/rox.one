# T314 - M.20 Phase 20 closeout document + RC tag decision matrix

Status: DONE
Phase: M.20

## Context

M.20 (RC validation phase) shipped a substantial body of work:
T298 pre-flight checklist + 72h soak protocol, T298b machine-
executable runner, T298c S09/S10 scenarios, plus codex's S01-S08
RC scenario series (T355-T362 et al). T314 closes M.20 with the
**summary document** that operators read at tag time and the
**RC tag decision matrix** that codifies GO / NO-GO / GO-with-
caveats.

## Ticket-id rationale

T299 (the original spine-reserved closeout slot) was used by
codex for a different M.20 follow-on. T299-T313 are mostly
taken. T314 is the next free slot in the spine integration range
(T299-T320). Branch named `docs/M20-T299-phase-20-closeout`
(original prompt naming) to keep the work history readable.

## Scope

DOCS-ONLY. Two new files plus this ticket + worklog:

- `docs/release/m20-phase-20-closeout.md` — summary of every M.20
  deliverable, the 14 lane-M phases done, the 3 operator-gated
  phases remaining, the 16 pre-flight gates + their state, and the
  72h soak telemetry signals.
- `docs/release/v1-rc-tag-decision-matrix.md` — 10 GO criteria,
  8 NO-GO criteria, 5 GO-with-caveats yellow signals, decision-
  time evidence packet, rollback procedure.

## Validation

- `bun run validate:rebrand` — pass
- `bun run validate:agent-contract` — pass (T314 Status: DONE)
- `bun run validate:roadmap` — pass

## Follow-ups

- **M.20 execution** — operator runs `bun run rc:preflight`, walks
  the matrix, decides on the `v1.0.0-rc.1` tag.
- **72h soak** — observe telemetry per the soak protocol.
- **R.11** — gated on soak GO.
- **M.21** — gated on R.11.
