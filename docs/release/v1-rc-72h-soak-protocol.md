# v1.0.0-rc.1 — 72-hour Soak Protocol

Owner gate: M.20. The soak begins the moment `v1.0.0-rc.1` is pushed to
`origin`. It ends 72 contiguous hours later if no soak-failure fired. If a
soak-failure fires inside the window, the soak resets to zero after rollback
and remediation.

The pre-flight checklist this protocol follows is
`docs/release/v1-rc-preflight-checklist.md`.

## 1. Observation window

- **Duration**: 72 contiguous hours from the tag-push timestamp.
- **Cadence**: operator pulls the observation panel every 6 hours, more often
  inside the first 12.
- **Owner**: release operator on call; `release-validator` agent assists with
  automated counts.

## 2. What to observe

| Signal | Source | Pass threshold |
| --- | --- | --- |
| Crash-free sessions | main-process error log + Crashlytics-equivalent telemetry stream | ≥ 99.5% sessions crash-free |
| Audit-event throughput | audit sink rotation log + structured-log producer counts | within ±20% of pre-tag baseline |
| Bundle load time | renderer boot trace logged on first frame | p95 cold load ≤ 2.5s |
| Memory pressure on idle | `process.memoryUsage()` sample at 10-minute intervals | RSS plateau ≤ 600 MB after 30 min idle |
| Renderer error rate | window `error` + `unhandledrejection` counts | ≤ 0.1 errors per session-minute |
| Audit-sink rotation | rotation events succeed, no dropped batches | zero rotation errors |
| RBAC denial bursts | denial events in audit feed | no burst > 50 denials/minute (DoS smell) |

## 3. What counts as a soak-failure

Any one of the following fires the rollback procedure in §4:

1. **Panic / fatal in main process** — any `FATAL` log line in the Electron
   main process, or any non-zero exit code from the main-process supervisor.
2. **Audit-sink rotation error** — any rotation-failure event in the
   audit-log producer, *or* a gap of more than 5 minutes between expected
   rotation checkpoints.
3. **M.16 bundle budget exceeded** — any subsequent renderer-bundle build on
   the tagged SHA reports a size over the `bundle-budget` threshold; this
   should be impossible at the tag SHA but a CI re-run regression on a hot-fix
   branch counts as a failure of the same RC.
4. **P0 user-reported issue** — any GitHub issue, support ticket, or internal
   report classified P0 (data loss, security exposure, app fully unusable on a
   supported platform) landed against the RC build.
5. **Validator regression** — any `bun run validate:*` from the pre-flight
   §1 list starts failing on the tagged SHA when re-run mid-soak.

## 4. Rollback procedure

If any §3 condition fires:

1. **Within 30 minutes**: announce in `#release-operations` with the
   failure-mode summary, the affected signal, and the rollback ETA.
2. **Within 60 minutes**: revert the `v1.0.0-rc.N` tag:
   ```sh
   git tag -d v1.0.0-rc.N
   git push origin :refs/tags/v1.0.0-rc.N
   ```
   No `--force` is needed because tag deletion is a separate ref op. If the
   tag had been published to a GitHub Release, mark the release as
   *pre-release / withdrawn* in the same step.
3. **Within 4 hours**: open `T298b-rc-soak-failure-<short-mode>.md` capturing:
   - the failure-mode summary,
   - the exact signal trace (log excerpt or screenshot),
   - the suspected root cause,
   - the proposed remediation patch scope,
   - the soak-reset plan (which preflight items must rerun).
4. **Re-enter pre-flight**: after remediation lands on `main`, re-run the
   full `docs/release/v1-rc-preflight-checklist.md` from §1; the next tag is
   `v1.0.0-rc.(N+1)`. The 72-hour clock restarts at zero on the new tag push.

## 5. Pass criteria

The soak passes — and `v1.0.0-rc.1` is promoted to `v1.0.0` per M.21 — when:

- 72 contiguous hours elapsed since the tag push.
- Zero §3 soak-failures fired in that window.
- Every §2 signal stayed inside its pass threshold for the full window.
- The §1 cadence logs are complete (no missed 6-hour checkpoints).
- The release evidence doc, `docs/release/v1-rc-evidence-<DATE>.md`, has the
  soak window appended with each cadence entry timestamped and signed by the
  on-call operator.

The promotion to `v1.0.0` is gated by M.21's own ticket (not this document)
and additionally by the P.4 announcement window (72 hours after the
`v1.0.0` tag, per the spine goal).

## 6. Linkage

- Pre-flight checklist: `docs/release/v1-rc-preflight-checklist.md`
- Owning ticket: `docs/tickets/T298-rc-preflight.md`
- Master-roadmap phase: M.20 (see
  `docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md`
  Phase 20 stopping condition)
- Soak-failure follow-up template: `T298b-rc-soak-failure-<short-mode>`
