# v1.0.0 — 72-Hour GA Soak Monitoring Plan

Owner gate: M.21. This document governs the monitoring window that begins when
`v1.0.0` is tagged and pushed to `origin`. It extends and specialises the RC
soak protocol (`docs/release/v1-rc-72h-soak-protocol.md`) for the **GA
promotion** step: the RC soak used `v1.0.0-rc.1`; this plan uses the final
`v1.0.0` tag.

> **Assumption note** — Rollback thresholds in §4 use industry-standard
> defaults (Google SRE "four nines" availability target; Stripe 5% error-rate
> rollback convention; Electron Forge community 90-95% install/update success
> range). Adjust to measured baselines once production telemetry is established.

---

## 1. Observation window

| Property | Value |
| --- | --- |
| Duration | 72 contiguous hours from `git push origin v1.0.0` |
| Cadence | Every 6 hours (every 2 hours during first 12 hours) |
| Owner | Release operator on call |
| Automated assist | `release-validator` skill pulls metric snapshots |
| Window reset | Any rollback trigger resets the clock to zero |

The window closes — and v1.0.0 is declared stable — only when 72 contiguous
hours pass with **every** §2 signal within its pass threshold and **zero** §4
triggers fired.

---

## 2. Metrics to watch

### 2.1 Error rate

| Signal | Source | Pass threshold | Rollback threshold |
| --- | --- | --- | --- |
| Renderer uncaught errors | `window error` + `unhandledrejection` event counts, written to audit-log NDJSON sink | ≤ 0.1 errors per session-minute (p95) | > 5% increase over pre-tag baseline for ≥ 15 minutes |
| Main-process logged errors | Electron main-process `error`-level log lines in `audit-log/*.ndjson` | < 0.5 errors per hour | Any `FATAL` log line, or rate > 5× pre-tag baseline for ≥ 5 minutes |
| IPC bridge errors | `ipc-error` audit events | 0 | ≥ 1 `FATAL`-classified IPC error |

**Baseline**: measured from the 72-hour RC soak window (`v1.0.0-rc.1`). If
the RC soak evidence doc is unavailable, use the pre-tag rolling 24-hour
average from the main-branch nightly run.

### 2.2 Crash rate

| Signal | Source | Pass threshold | Rollback threshold |
| --- | --- | --- | --- |
| Crash-free sessions | Electron `app.on('before-quit')` + crash reporter; counted in audit-log | ≥ 99.5% sessions crash-free | < 98% crash-free sessions over any 1-hour window |
| Unhandled Electron crash | OS crash dump in `%APPDATA%\ROX.ONE\Crashpad` (Win) / `~/Library/Logs/ROX.ONE` (Mac) | 0 new dump files | Any new main-process dump file |

### 2.3 Install success rate

| Signal | Source | Pass threshold | Rollback threshold |
| --- | --- | --- | --- |
| Install completion | CDN download logs + first-launch audit event (`app:first-launch`) | ≥ 95% of download completions produce a first-launch event within 10 minutes | < 90% completion rate for any 4-hour cohort |
| Install script exit code | `install-app.sh` / `install-app.ps1` telemetry (if opt-in) | exit 0 | Any systematic non-zero exit affecting ≥ 2% of installs |

> Threshold justification: 95% pass / 90% rollback floor is derived from
> Electron Forge community data showing 90-95% as the healthy range for
> desktop distribution pipelines, where OS-level friction (Gatekeeper,
> SmartScreen) is the dominant failure mode.

### 2.4 Update success rate (auto-update path)

| Signal | Source | Pass threshold | Rollback threshold |
| --- | --- | --- | --- |
| Update download + apply | `electron-updater` audit events (`update:downloaded`, `update:applied`) | ≥ 99% of update-check sessions that receive an available update complete the apply step | < 95% apply-success rate over any 4-hour window |
| Signature verification | `update:signature-valid` event in audit-log (PR #179 hardening) | All updates carry a valid signature event | Any `update:signature-invalid` event; zero tolerance |
| Update auto-rollback | Squirrel self-rollback telemetry | 0 auto-rollbacks | ≥ 1 Squirrel auto-rollback event |

> Threshold justification: 99% apply-success pass threshold aligns with
> Electron community norms for desktop update pipelines where network
> interruptions are the dominant failure mode. The 95% rollback floor is
> 4 percentage points below pass, giving a buffer for transient network
> issues before triggering a full product rollback.

### 2.5 Auth failure rate

| Signal | Source | Pass threshold | Rollback threshold |
| --- | --- | --- | --- |
| Auth token rejection (401) | Audit-log `auth:rejected` events | < 0.5% of authenticated requests | > 3% of authenticated requests for ≥ 10 minutes |
| RBAC denial bursts | `rbac:denied` events in audit feed | ≤ 50 denials per minute (DoS threshold per RC soak protocol) | > 50 denials/minute for ≥ 3 consecutive minutes |
| Session expiry anomaly | Gap between `auth:session-start` and `auth:session-end` vs expected TTL | Within ±10% of configured TTL | > 50% deviation from TTL affecting ≥ 5% of sessions |

---

## 3. Signal sources

### 3.1 Audit-log NDJSON tail

The primary observability surface. The audit-log sink writes append-only NDJSON
files rotated on a configurable schedule (default: hourly). To tail live:

```sh
# Tail the most recent audit sink file
tail -f "$(ls -t ~/.config/rox-one/audit-log/*.ndjson | head -1)" | \
  jq 'select(.level == "error" or .level == "fatal" or .type == "rbac:denied")'

# Count error events in the last rotation window
jq -r 'select(.level == "error") | .timestamp' \
  ~/.config/rox-one/audit-log/$(date +%Y-%m-%dT%H).ndjson | wc -l
```

On Windows, replace the path with `%APPDATA%\rox-one\audit-log\`.

### 3.2 Sentry dashboard (if configured)

If a Sentry DSN is configured via `ROX_ONE_SENTRY_DSN` in the environment:

- Monitor the **Issues** tab for new P0/P1 issues tagged against `v1.0.0`.
- Watch the **Performance** tab for p95 transaction latency regressions.
- Set up a Sentry alert rule: notify `#release-operations` Slack channel if
  new issue count > 5 in any 30-minute window during the soak.

If Sentry is not configured, the audit-log NDJSON tail (§3.1) is the sole
error source.

### 3.3 Download CDN logs

Access GitHub Releases download counts via:

```sh
gh api repos/:owner/:repo/releases/latest \
  --jq '.assets[] | {name: .name, downloads: .download_count}'
```

For a custom CDN (if present), pull CDN access logs and correlate with
`app:first-launch` audit events to compute install completion rate.

### 3.4 Memory and performance sampling

Sample memory pressure at 10-minute intervals during the soak:

```sh
# If a debug/probe endpoint is exposed by the main process
curl -s http://localhost:<probe-port>/metrics | grep rss_bytes
```

Pass threshold: RSS plateau ≤ 600 MB after 30 minutes idle
(inherited from the RC soak protocol).

---

## 4. Rollback trigger thresholds

A rollback is initiated immediately (within 30 minutes of detection) when
**any one** of the following conditions fires:

| Trigger | Threshold | Response time |
| --- | --- | --- |
| Main-process `FATAL` log line | Any occurrence | < 30 min |
| Crash-free session rate below floor | < 98% over any 1-hour window | < 30 min |
| Renderer error rate spike | > 5% increase over pre-tag baseline for ≥ 15 min | < 30 min |
| Update signature-invalid event | Any `update:signature-invalid` | < 30 min |
| P0 user-reported issue | Any GitHub issue / support report classified P0 | < 30 min |
| Install completion rate drop | < 90% for any 4-hour cohort | < 60 min |
| Auto-update apply failure | < 95% apply-success over any 4-hour window | < 60 min |
| Auth rejection spike | > 3% of requests for ≥ 10 min | < 30 min |
| RBAC denial burst | > 50 denials/minute for ≥ 3 min | < 30 min |
| Validator regression | Any `bun run validate:*` fails on the tagged SHA mid-soak | < 60 min |
| Audit-sink rotation error | Any rotation failure or > 5-min gap between expected checkpoints | < 60 min |

> **Threshold justification**: the 5% error-rate spike threshold follows the
> Stripe engineering rollback convention (roll back if any metric moves more
> than 5% from baseline during a release window). The 98% crash-free floor
> aligns with the Google SRE "three nines" soft target for desktop applications
> in early GA — 1.5 percentage points below the 99.5% RC soak pass threshold,
> giving a realistic buffer before a full rollback. Install and update
> thresholds are based on Electron Forge community data.

---

## 5. Cadence log format

The operator records one entry per cadence check in the soak evidence doc
(`docs/release/v1-rc-evidence-<DATE>.md`, appended after the tag commit):

```
## Soak check — <ISO-8601 timestamp> (T+<hours>h)

| Signal | Value | Threshold | Status |
| --- | --- | --- | --- |
| Crash-free sessions | 99.9% | >= 99.5% | PASS |
| Renderer errors/session-min | 0.02 | <= 0.1 | PASS |
| Auth rejection rate | 0.1% | < 0.5% | PASS |
| Update apply rate | 99.7% | >= 99% | PASS |
| Audit-sink rotation | OK | 0 errors | PASS |

Signed: <operator-name> (<timestamp>)
```

No missed checkpoints are permitted. A missed 6-hour window requires a written
note explaining the gap; it does not itself trigger a rollback but delays the
soak-pass declaration until the gap is accounted for.

---

## 6. On-call rotation expectations

| Period | Availability | Check cadence |
| --- | --- | --- |
| T+0 to T+12h | Within 30 minutes of any alert | Every 2 hours |
| T+12h to T+48h | Within 60 minutes of any alert | Every 6 hours |
| T+48h to T+72h | Within 90 minutes of any alert | Every 6 hours |

**Escalation path**:

1. Any trigger fires → post in `#release-operations` immediately.
2. P0 crash or security issue → page the on-call engineer directly (do not
   wait for the next Slack check).
3. Uncertain whether a threshold was crossed → assume yes; initiate rollback
   and re-evaluate within 30 minutes with full context.

**Shift handoff protocol**: when the on-call operator changes during the soak
window, post a brief handoff note in `#release-operations` covering current
signal status, open questions, and any in-progress investigations.

---

## 7. Pass declaration

The soak passes — and `v1.0.0` is declared stable — when **all** of:

1. 72 contiguous hours elapsed since `git push origin v1.0.0`.
2. Zero rollback triggers (§4) fired during the window.
3. Every §2 signal remained inside its pass threshold for the full window.
4. All cadence log entries are present and signed (no unexplained gaps).
5. The soak evidence doc is complete and committed to `main`.

On pass: append the soak result to the evidence doc, merge to `main`, and
announce in `#release-operations` and any external status channel.

---

## 8. Linkage

- Pre-flight checklist: `docs/release/v1-rc-preflight-checklist.md`
- RC soak protocol: `docs/release/v1-rc-72h-soak-protocol.md`
- Rollback plan: `docs/release/v1-rollback-plan.md`
- GitHub Release template: `docs/release/v1-github-release-template.md`
- Owning ticket: `docs/tickets/T359-v1-release-prep.md`
- Master roadmap phase: M.21
