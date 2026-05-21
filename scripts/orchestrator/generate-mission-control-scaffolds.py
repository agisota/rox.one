#!/usr/bin/env python3
"""
Mission control artifact scaffold generator.

Для каждого Wave 0 WT (WT-00..09 + WT-45..50) генерирует:
  docs/mission-control/<wt-id>/
    cjm/<scenario>.md        — один per cjm_scenario
    erd/entities.mmd         — один если entities_touched непуст
    sequence/<event>.mmd     — один per event_emitted
    ui-inventory/<surface>.md — один per ui_surface
    observability/metrics.md — всегда

Файлы — minimum viable scaffolds; реальное content writes happens during
discovery/design phases by 22-role swarm. Цель: unblock merge-gate checks.

Idempotent: skip if file already exists.
"""
import os
import re
import sys
from pathlib import Path
import yaml

REPO = Path("/home/dev/craft/rox-one-v2-exclusive")
MC_ROOT = REPO / "docs" / "mission-control"

# Wave 0 = foundation (WT-00..09) + Object Platform (WT-45..50)
WAVE_0_IDS = [f"WT-{i:02d}" for i in range(10)] + ["WT-45", "WT-46", "WT-47", "WT-48", "WT-49", "WT-50"]

def slugify(s):
    s = re.sub(r"[^a-zA-Z0-9-]+", "-", s.strip())
    return re.sub(r"-{2,}", "-", s).strip("-").lower()

def cjm_template(wt_id, wt_title, scenario):
    return f"""# CJM: {scenario}

**WT:** {wt_id} — {wt_title}
**Scenario:** `{scenario}`

> _Scaffold — to be filled during discovery phase by cjm-writer role._

## Trigger
TBD — что вызывает этот scenario?

## Pre-conditions
- [ ] Identity / auth state
- [ ] Feature flag state
- [ ] Data preconditions

## Steps (happy path)
1. TBD
2. TBD
3. TBD

## Hopes
- TBD — что юзер ожидает / надеется

## Fears
- TBD — что юзер боится / о чём беспокоится

## Success criteria
- TBD — измеримый outcome

## Failure modes
- TBD — известные edge cases

## Touchpoints
- UI: TBD
- API: TBD
- Notifications: TBD

## Metrics
- TBD — какой metric отражает успех scenario
"""

def erd_template(wt_id, wt_title, entities):
    if not entities:
        return None
    ents = "\n".join(f"    {e} {{}}" for e in entities)
    return f"""---
title: "{wt_id} — Entity diagram"
---
erDiagram
%% Scaffold — to be filled during design phase by erd-writer role.
%% Entities tracked: {", ".join(entities)}
{ents}

%% Relations (TODO):
%% EntityA ||--o{{ EntityB : "describes-relation"
"""

def sequence_template(wt_id, event_name):
    actor_a = "User"
    actor_b = "Renderer"
    actor_c = "Main / Server"
    actor_d = "ActivityEvent (WT-49)"
    return f"""---
title: "{wt_id} — event: {event_name}"
---
sequenceDiagram
%% Scaffold — to be filled during design phase by sequence-chart-writer role.
participant U as {actor_a}
participant R as {actor_b}
participant M as {actor_c}
participant A as {actor_d}

U->>R: TBD trigger
R->>M: TBD IPC call
M->>M: TBD work
M->>A: emit("{event_name}", payload)
M-->>R: TBD response
R-->>U: TBD UI update
"""

def ui_inventory_template(wt_id, wt_title, surface):
    return f"""# UI Surface: {surface}

**WT:** {wt_id} — {wt_title}
**Surface:** `{surface}`

> _Scaffold — to be filled during design phase by ui-inventory-writer role._

## States
- [ ] Empty
- [ ] Loading
- [ ] Loaded (data)
- [ ] Error
- [ ] Permission-denied

## Variants
- [ ] Light / Dark mode
- [ ] Mobile / Desktop / Web responsive
- [ ] LTR / RTL

## a11y annotations
- [ ] Keyboard navigation order documented
- [ ] aria-label на all interactive elements
- [ ] axe-core score ≥ 95
- [ ] Tab trap / focus management

## Interactions
- TBD: click → ?
- TBD: keyboard → ?
- TBD: drag/drop → ?

## Performance
- LCP target: ≤ 2.5s
- INP target: ≤ 200ms
- Bundle delta: ≤ X KB

## Screenshots
- TBD: empty.png
- TBD: loaded.png
- TBD: error.png
"""

def observability_template(wt_id, wt_title, events, work_type):
    events_section = "\n".join(f"- `{e}` — TBD metric/alert" for e in events) if events else "_(no events)_"
    return f"""# Observability: {wt_id}

**WT:** {wt_id} — {wt_title}
**Work type:** `{work_type}`

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
{events_section}

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
"""

def process_wt(wt_id, yaml_path):
    wt = yaml.safe_load(yaml_path.read_text())
    mc = wt.get("mission_control", {})
    title = wt["title"]
    mc_dir = MC_ROOT / wt_id.lower()
    created = 0
    skipped = 0

    # cjm/
    for scenario in mc.get("cjm_scenarios", []):
        d = mc_dir / "cjm"
        d.mkdir(parents=True, exist_ok=True)
        f = d / f"{slugify(scenario)}.md"
        if f.exists():
            skipped += 1
        else:
            f.write_text(cjm_template(wt_id, title, scenario))
            created += 1

    # erd/
    entities = mc.get("entities_touched", [])
    if entities:
        d = mc_dir / "erd"
        d.mkdir(parents=True, exist_ok=True)
        f = d / "entities.mmd"
        if f.exists():
            skipped += 1
        else:
            f.write_text(erd_template(wt_id, title, entities))
            created += 1

    # sequence/
    for event in mc.get("events_emitted", []):
        if event == "foundational-emit-policy":
            continue
        d = mc_dir / "sequence"
        d.mkdir(parents=True, exist_ok=True)
        f = d / f"{slugify(event)}.mmd"
        if f.exists():
            skipped += 1
        else:
            f.write_text(sequence_template(wt_id, event))
            created += 1

    # ui-inventory/
    for surface in mc.get("ui_surfaces", []):
        d = mc_dir / "ui-inventory"
        d.mkdir(parents=True, exist_ok=True)
        f = d / f"{slugify(surface)}.md"
        if f.exists():
            skipped += 1
        else:
            f.write_text(ui_inventory_template(wt_id, title, surface))
            created += 1

    # observability/
    d = mc_dir / "observability"
    d.mkdir(parents=True, exist_ok=True)
    f = d / "metrics.md"
    if f.exists():
        skipped += 1
    else:
        f.write_text(observability_template(wt_id, title, mc.get("events_emitted", []), mc.get("work_type", "—")))
        created += 1

    return created, skipped

def main():
    print(f"=== Mission control scaffolds for Wave 0 ({len(WAVE_0_IDS)} WTs) ===\n")
    total_created = 0
    total_skipped = 0
    for wt_id in WAVE_0_IDS:
        yaml_path = REPO / "wt-meta" / f"{wt_id.lower()}.yaml"
        if not yaml_path.exists():
            print(f"  [{wt_id}] ! yaml missing — skip")
            continue
        c, s = process_wt(wt_id, yaml_path)
        total_created += c
        total_skipped += s
        print(f"  [{wt_id}] +{c} created / ={s} skipped")
    print(f"\n=== Total: +{total_created} created / ={total_skipped} skipped ===")
    return 0

if __name__ == "__main__":
    sys.exit(main())
