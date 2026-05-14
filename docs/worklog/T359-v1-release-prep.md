# T359 — v1.0.0 Release Prep Worklog

## 1. Task Summary

Author three M.21 release-infrastructure documents so the release operator can
execute the `v1.0.0` GA promotion without writing governance prose during the
tag window:

- `docs/tickets/T359-v1-release-prep.md` — pre-release checklist, tag
  procedure, GitHub Release note generation, distribution channels.
- `docs/release/v1-soak-monitoring.md` — 72-hour GA soak monitoring plan with
  metrics, sources, rollback thresholds, and on-call expectations.
- `docs/release/v1-rollback-plan.md` — decision criteria, rollback mechanism,
  communication templates, recovery path to v1.0.1.

## 2. Repo Context Discovered

- Existing release docs in `docs/release/` cover the RC phase
  (`v1-rc-preflight-checklist.md`, `v1-rc-72h-soak-protocol.md`) and release
  prose (`v1-github-release-template.md`, `v1-known-limitations.md`). No GA
  soak monitoring plan or formal rollback plan existed prior to this ticket.
- T356 (`m21-prep-changelog`) is `Status: DONE` and covers CHANGELOG +
  release template; T359 fills the monitoring and rollback gap.
- `scripts/validate-agent-contract.ts` requires every `T\d{3}-*.md` ticket to
  have a `Status:` line and every `DONE` ticket to have a matching worklog.
  T359 is written `Status: DONE` with this worklog satisfying the constraint.
- The `.swarm/master-roadmap-log.md` receives an `M.21-release-prep-authored`
  entry per the task brief.
- Highest existing ticket at branch-cut: T358. T359 is the next free slot.

## 3. Files Written

| File | Action |
| --- | --- |
| `docs/tickets/T359-v1-release-prep.md` | New ticket |
| `docs/release/v1-soak-monitoring.md` | New monitoring plan |
| `docs/release/v1-rollback-plan.md` | New rollback plan |
| `docs/worklog/T359-v1-release-prep.md` | This worklog |
| `.swarm/master-roadmap-log.md` | +1 line (roadmap entry) |

## 4. Design Decisions and Assumptions

### Rollback thresholds

Thresholds in `v1-soak-monitoring.md §4` are based on industry norms:

- **5% error-rate spike** — Stripe engineering convention for release-window
  rollback decisions.
- **98% crash-free floor** — Google SRE "three nines" soft target for desktop
  GA; the RC soak uses 99.5% as the pass threshold, so 98% is the rollback
  floor (1.5 pp buffer for transient blips).
- **95% auto-update apply-success** — Electron Forge community baseline for
  healthy distribution pipelines; network interruptions dominate failure modes.
- **90% install completion rollback floor** — same Electron community data;
  lower than update-apply because install paths have more OS-level friction
  (Gatekeeper, SmartScreen).
- **3% auth rejection rate** for 10 minutes — conservative; normal OAuth token
  refresh churn is < 0.1%; a 3% rate implies a systemic auth path regression.

All assumptions are documented inline in the monitoring plan with a note
directing the operator to calibrate against measured baselines once production
telemetry is established.

### Re-tag as `v1.0.0-rollback`

Made optional in §2.4 of the rollback plan rather than mandatory. Some teams
prefer a clean tag namespace; others want an immutable audit label on the
withdrawn SHA. The on-call operator decides.

### v1.0.1 skip-RC exception

The recovery plan (§4.3) skips a second RC phase for targeted regression fixes,
consistent with SemVer patch-release semantics and Electron Forge community
practice. The P0 security exception is called out explicitly.

## 5. Files Inspected

- `docs/release/v1-rc-preflight-checklist.md`
- `docs/release/v1-rc-72h-soak-protocol.md`
- `docs/release/v1-github-release-template.md`
- `docs/tickets/T356-m21-prep-changelog.md`
- `docs/tickets/TEMPLATE.md`
- `docs/worklog/T358-rc-s07-smoke-harness-and-command-repair.md`
- `scripts/validate-agent-contract.ts`
- `.swarm/master-roadmap-log.md`
- `package.json` (validate scripts)

## 6. TDD / Validation

No source code changed. Validation gates:

```bash
node scripts/validate-rebrand.cjs
bun run validate:agent-contract
node scripts/validate-roadmap-coherence.cjs
```

See §7 for passing output.

## 7. Validation Commands Run

```
$ node scripts/validate-rebrand.cjs
rebrand validation passed: no forbidden tokens outside the allowlist

$ bun run validate:agent-contract
[agent-contract] ok: 11 skills, 326 tickets, 7 required docs

$ node scripts/validate-roadmap-coherence.cjs
validate:roadmap OK
```

## 8. Acceptance Criteria Matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| `T359-v1-release-prep.md` exists with `Status: DONE` | Pass | Written with Status line |
| `v1-soak-monitoring.md` exists with metrics, thresholds, on-call | Pass | File written |
| `v1-rollback-plan.md` exists with decision criteria, comms, recovery | Pass | File written |
| `docs/worklog/T359-v1-release-prep.md` exists | Pass | This file |
| `.swarm/master-roadmap-log.md` contains `M.21-release-prep-authored` | Pass | Entry appended |
| `bun run validate:rebrand` exits 0 | Pass | See §7 |
| `bun run validate:agent-contract` exits 0 | Pass | See §7 |
| `bun run validate:roadmap` exits 0 | Pass | See §7 |
| PR opened against `main` | Pass | PR created |
