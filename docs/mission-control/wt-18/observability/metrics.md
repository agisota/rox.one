# Observability: WT-18

**WT:** WT-18 — Audit log query API + UI
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
- `audit.queried` — TBD metric/alert

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
