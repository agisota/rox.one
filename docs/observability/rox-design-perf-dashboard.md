# Rox Design — performance telemetry dashboard

PZD-83 (spec §1.6.A) — perf telemetry for the embedded Rox Design panel.

This file defines the ops-side dashboard that consumes the telemetry records
emitted by `apps/electron/src/main/rox-design-telemetry.ts`. Each record is
mirrored to both the structured `mainLog` and to Sentry as a breadcrumb under
the `rox-design.perf` category, so dashboards can be built on either pipeline.

## Telemetry record shape

```ts
{
  integration: 'rox-design'
  event: 'first-show' | 'warm-open' | 'inp-sample'
  phase?: 'spawn-sidecar' | 'register-desktop-auth' | 'attach-view'
        | 'load-url'      | 'dom-ready'             | 'did-finish-load'
  durationMs: number
  platform: 'darwin' | 'linux' | 'win32'
  arch: 'arm64' | 'x64'
  cold: boolean
}
```

Records with no `phase` are total lifecycle measurements (the whole
click-to-loaded duration). Phase records are per-step sub-measurements
emitted in real time.

## Spec targets (1.6 success thresholds)

- Cold start P95           ≤ 1500 ms
- Warm open P95            ≤ 300 ms
- In-cache reload P95      ≤ 100 ms
- INP inside panel         < 200 ms

## Panel definitions

### Panel 1 — First-show latency (P50 / P95 / P99 per platform)

- Query: `event = first-show AND phase IS NULL`
- Group by: `platform`, `arch`
- Aggregations: P50, P95, P99 of `durationMs`
- Threshold lines: 1500 ms (P95 target)

### Panel 2 — Warm-open latency (P50 / P95 / P99 per platform)

- Query: `event = warm-open AND phase IS NULL`
- Group by: `platform`, `arch`
- Aggregations: P50, P95, P99 of `durationMs`
- Threshold lines: 300 ms (P95 target), 100 ms (in-cache target)

### Panel 3 — Phase breakdown (cold start)

- Query: `event = first-show AND phase IS NOT NULL`
- Group by: `phase`
- Aggregation: P50 of `durationMs`
- Visualization: stacked bar chart (one bar per platform/arch combo)
- Phases ordered: `spawn-sidecar` → `register-desktop-auth` → `attach-view`
  → `load-url` → `dom-ready` → `did-finish-load`

### Panel 4 — INP histogram (in-panel responsiveness)

- Query: `event = inp-sample`
- Group by: `platform`, `arch`
- Visualization: histogram of `durationMs`, bins 0/16/32/64/128/200/300/500/1000+
- Threshold line: 200 ms
- Annotation: P95 INP per platform / arch

### Panel 5 — Failure rate (sanity)

- Query: `event IN (first-show, warm-open) AND phase IS NULL AND durationMs > 3000`
- Display: count per (platform, arch) over rolling 24h
- Threshold: alert if any single platform exceeds 1% of total `first-show`
  events.

## Data sources

- **Sentry breadcrumbs** — every record is added as a breadcrumb on the active
  scope (`category: 'rox-design.perf'`). Dashboard query examples assume a
  Sentry Discover query filtering `breadcrumbs.category = "rox-design.perf"`
  and unpacking `breadcrumbs.data.*` fields.
- **Local structured log** — `mainLog.info('[rox-design:perf]', record)`
  writes to `~/Library/Logs/ROX.ONE/main.log` (macOS) /
  `%APPDATA%/ROX.ONE/logs/main.log` (Windows) /
  `~/.config/ROX.ONE/logs/main.log` (Linux). Useful for support tickets when
  a user reports a slow open — grep for `[rox-design:perf]` to reconstruct
  their last lifecycle.

## Sample alerting rules

- `first-show P95 over 1500ms for any (platform, arch) within 1h` — page on-call.
- `inp-sample P95 over 200ms for any (platform, arch) within 6h` — open ticket
  for performance follow-up.
- `Phase `spawn-sidecar` median over 800ms` — investigate Open Design sidecar
  startup regression.
