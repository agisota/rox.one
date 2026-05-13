# v1.0.0 — Rollback Plan

Owner gate: M.21. This document defines when and how to roll back the `v1.0.0`
GA release if a soak-failure fires during the 72-hour monitoring window. It is
the companion to `docs/release/v1-soak-monitoring.md` (which defines the
metrics and triggers) and `docs/release/v1-rc-72h-soak-protocol.md` (which
covers the RC phase rollback procedure).

> **Scope**: this plan covers rolling back the `v1.0.0` GA tag. For RC tag
> rollbacks (`v1.0.0-rc.N`), follow §4 of `v1-rc-72h-soak-protocol.md`.

---

## 1. Decision criteria — when to roll back

Roll back immediately (target: decision within 15 minutes, execution complete
within 60 minutes) when **any one** of the following is confirmed:

| Criterion | Description |
| --- | --- |
| Main-process fatal | Any `FATAL` log line in the Electron main process, or any non-zero exit from the main-process supervisor. |
| Crash rate below floor | Crash-free session rate < 98% over any 1-hour window during the soak. |
| Renderer error spike | Renderer error rate > 5% above the pre-tag baseline for >= 15 minutes. |
| Signature verification failure | Any `update:signature-invalid` event from the auto-update path (PR #179 hardening). Zero tolerance. |
| P0 user report | Any GitHub issue, support ticket, or internal report classified P0 (data loss, security exposure, app fully unusable on a supported platform). |
| Auth/RBAC anomaly | Auth rejection rate > 3% of requests for >= 10 minutes, or RBAC denial burst > 50/minute for >= 3 consecutive minutes. |
| Systemic install failure | Install completion rate < 90% for any 4-hour cohort. |
| Update apply failure | Auto-update apply-success rate < 95% over any 4-hour window. |
| Validator regression | Any `bun run validate:*` command from the pre-flight checklist fails on the tagged SHA when re-run mid-soak. |
| Audit-sink disruption | Rotation failure or > 5-minute gap between expected rotation checkpoints. |

**Do not roll back** for:

- Isolated one-off errors that self-resolve and do not cross a threshold.
- Known-limitation issues already tracked in `docs/release/v1-known-limitations.md`.
- Cosmetic or UX regressions that do not block core workflows — open a `fix/`
  PR and ship as `v1.0.1` instead.

When uncertain, err toward rollback. A rolled-back v1.0.0 re-released after
remediation causes less harm than leaving users on a subtly broken build.

---

## 2. Rollback mechanism

### 2.1 Announce (within 15 minutes of confirming a trigger)

Post in `#release-operations`:

```
[ROLLBACK-INITIATED] v1.0.0 rollback in progress.
Trigger: <one-line description>
Signal: <exact log excerpt or metric value>
ETA for tag deletion: <HH:MM UTC>
On-call: <operator name>
```

Set the public status page (if maintained) to "Investigating" immediately.

### 2.2 Block the auto-update feed (within 30 minutes)

Before deleting the tag, prevent additional users from auto-updating to the
broken build by blocking the update feed. Steps depend on the private release
pipeline (ADR-0109):

1. Remove or rename the `latest.yml` / `latest-mac.yml` / `latest-linux.yml`
   update manifest from the release pipeline bucket/CDN.
2. If manifests cannot be removed immediately, set the version field in the
   manifest to a pre-`v1.0.0` value so `electron-updater` does not serve the
   broken release as the latest target.
3. Verify the block by running the update-check flow on a test machine and
   confirming no update is offered.

### 2.3 Delete the tag and mark the release withdrawn (within 60 minutes)

```sh
# Delete the local tag
git tag -d v1.0.0

# Delete the remote tag (no --force needed; tag deletion is a separate ref op)
git push origin :refs/tags/v1.0.0

# Mark the GitHub Release as pre-release / withdrawn
gh release edit v1.0.0 --prerelease --title "v1.0.0 [WITHDRAWN]"
```

Add a warning banner to the GitHub Release body:

```markdown
> [!WARNING]
> This release has been withdrawn due to a post-GA issue. See v1.0.1 for the
> corrected build. Do not install from this release.
```

Alternatively, delete the release entirely if a withdrawn listing would cause
confusion:

```sh
gh release delete v1.0.0 --yes
```

### 2.4 Re-tag as `v1.0.0-rollback` (optional — for audit trail)

If the team wants a permanent, inspectable label on the withdrawn SHA for
post-mortem purposes:

```sh
git tag v1.0.0-rollback <sha-of-withdrawn-v1.0.0>
git push origin v1.0.0-rollback
```

This tag is **not** served by the auto-update feed. It is audit-only. Whether
to create it is the on-call operator's decision.

### 2.5 Open a failure ticket (within 4 hours)

Create `docs/tickets/T359b-v1-soak-failure-<short-mode>.md` with:

- Failure-mode summary (one paragraph).
- Exact signal trace (log excerpt or screenshot path).
- Suspected root cause and affected code paths.
- Proposed remediation patch scope (files and PRs needed).
- Soak-reset plan: which pre-flight items must rerun.

Use `Status: ACTIVE` until remediation is merged, then `Status: DONE`.

---

## 3. Communication templates

### 3.1 Internal Slack — #release-operations (within 15 minutes)

```
:rotating_light: ROX.ONE v1.0.0 ROLLBACK INITIATED

Trigger: <one-line trigger description>
Signal: <exact value or log line>
Action: auto-update feed blocked; tag deletion in progress
ETA stabilised: <expected v1.0.1 date or TBD>

Ticket: docs/tickets/T359b-v1-soak-failure-<short-mode>.md
On-call: <operator>
```

### 3.2 Status page / incident channel (within 30 minutes of rollback decision)

```
Investigating — ROX.ONE v1.0.0 post-release issue

We identified an issue affecting [brief user-visible description] after the
v1.0.0 GA release. We have initiated a rollback and are working on a fix.

Status: INVESTIGATING
Affected: [platforms / user groups if known]
Mitigation: Users who have not yet updated will not receive v1.0.0 via
auto-update. Users who have already updated can [workaround if any, or
"contact support for assistance"].

Next update: <T+60 min timestamp>
```

Update the status page every 60 minutes until the incident is closed.

### 3.3 In-app banner (if an in-app notification surface exists)

Trigger a notification via the in-app banner API for users already on v1.0.0.
Keep text under 120 characters for the dismissible notification surface:

```
ROX.ONE v1.0.0 has a known issue. A fix (v1.0.1) is being prepared.
[Optional: brief workaround.] We'll notify you when the fix is ready.
```

### 3.4 Email to early-access list (within 4 hours, if list exists)

Subject: `[Action required] ROX.ONE v1.0.0 issue — please await v1.0.1`

Body outline:
1. What happened (one paragraph, non-technical).
2. Who is affected and how to identify whether you are.
3. What we are doing (rollback + remediation timeline).
4. What to do right now (workaround if any; otherwise "no action needed").
5. When to expect the fix (estimated v1.0.1 date).
6. Contact info for urgent issues.

---

## 4. Recovery plan — path to v1.0.1

### 4.1 Root cause analysis (within 24 hours of rollback)

Publish a root cause analysis (RCA) in
`docs/release/v1-rca-<short-mode>-<DATE>.md` covering:

- Timeline of events (detection through rollback completion).
- Root cause (code or configuration).
- Why the pre-flight checklist and RC soak did not catch it.
- Remediation actions (code fix, added test, updated threshold).
- Process improvements to prevent recurrence.

### 4.2 Remediation patch

1. Open a `fix/<short-mode>` branch off `main`.
2. Implement the minimal fix. Add a regression test for the failure mode.
3. Run the full pre-flight gate:
   ```sh
   bun run validate:ci && bun run validate:release
   ```
4. Open a PR; require review from at least one engineer not involved in the
   original v1.0.0 tagging.
5. Merge to `main`.

### 4.3 Re-attempt path — v1.0.1

After the fix merges:

1. Run the full pre-flight checklist (`docs/release/v1-rc-preflight-checklist.md`)
   from §1 on the new `main` HEAD.
2. Tag `v1.0.1` (patch version bump per semantic versioning; no RC phase is
   required for a targeted regression fix unless the root cause was a P0
   security issue — see below).
3. Restart the 72-hour soak using `docs/release/v1-soak-monitoring.md`. The
   cadence log entries restart from T+0.
4. Update `CHANGELOG.md` with a `## [1.0.1]` entry documenting the fix and
   referencing the failure ticket and RCA.

> **P0 security exception**: if the root cause is a security exposure, treat
> `v1.0.1` as a security release. Coordinate a responsible disclosure window
> before publishing release notes, and notify affected users directly before
> the fix is public.

### 4.4 Close the failure ticket

Once `v1.0.1` passes its 72-hour soak:

1. Mark `docs/tickets/T359b-v1-soak-failure-<short-mode>.md` as `Status: DONE`.
2. Create `docs/worklog/T359b-v1-soak-failure-<short-mode>.md`.
3. Append an entry to `.swarm/master-roadmap-log.md`:
   ```
   M.21-v1.0.1-recovery | <sha> | T359b | <ISO-8601 timestamp>
   ```
4. Update the roadmap goal doc if Phase 21's stopping condition requires
   amendment for the recovery path.

---

## 5. Linkage

- Monitoring plan: `docs/release/v1-soak-monitoring.md`
- RC soak protocol: `docs/release/v1-rc-72h-soak-protocol.md`
- Pre-flight checklist: `docs/release/v1-rc-preflight-checklist.md`
- GitHub Release template: `docs/release/v1-github-release-template.md`
- Owning ticket: `docs/tickets/T359-v1-release-prep.md`
- Master roadmap phase: M.21
- Auto-update hardening: PR #179 (`fix/auto-update-hardening`)
- Audit-log observability: PR #99 (M.14/T245)
