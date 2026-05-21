# Observability: WT-24

**WT:** WT-24 — Quota engine
**Work type:** `new_module`

> _Scaffold — to be filled during optimize phase by observability-engineer role._

## Metrics

### Counters
- TBD `<feature>_total` — invocations
- TBD `<feature>_errors_total` — error count

### Histograms
- TBD `<feature>_duration_seconds` — latency P50/P95/P99

### Gauges
- TBD `<feature>_active` — current active state

## Events emitted (WT-49 ActivityEvent)
- `quota.warn` — TBD metric/alert
- `quota.exceeded` — TBD metric/alert

## Alerts

- [ ] P0 alert: TBD threshold
- [ ] P1 alert: TBD threshold

## Dashboards
- Grafana / metabase URL: TBD
- Owner team: TBD

## SLOs
- Availability: 99.X%
- Latency P95: TBD ms
- Error rate: ≤ TBD%

## Log queries
```sql
-- TBD: representative query
```
