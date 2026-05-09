# Decision 0001: Audit Finding Model

- Status: accepted
- Date: 2026-05-09

## Canonical

```ts
type Phase = "A.1" | "A.2" | "A.3" | "A.4";
type Surface = "renderer" | "webui" | "viewer" | "marketing";
type FindingSeverity = "critical" | "high" | "medium" | "low";

interface Finding {
  schemaVersion: 1;
  id: string;             // sha256(probe|rule|file|line)[:16]
  probe: string;
  surface: Surface;
  phase: Phase;
  severity: FindingSeverity;
  rule: string;
  location: { file: string; line?: number; column?: number; selector?: string; route?: string };
  message: string;
  evidence?: { screenshot?: string; codeSnippet?: string; consoleLog?: string };
  suggestedFix?: string;
  confidence: number;     // 0..1
  vdiImpact: { quality: number; risk: number; readiness: number };
  firstSeen: string;      // ISO timestamp
  lastSeen: string;       // ISO timestamp
}
```

```ts
interface Manifest {
  schemaVersion: 1;
  runId: string;          // ISO timestamp with ":"/"." replaced by "-"
  status: "ok" | "error";
  probes: string[];
  surfaces: Surface[];
  durationMs: number;
  completedAt: string;
}
```

```text
score(f) = severityWeight[f.severity]
         * surfaceWeight[f.surface]
         * f.confidence
         + avg(f.vdiImpact) * vdiBonusMax
sort: score desc, then f.id asc (stable tie-break)
```

## Why

- **One Finding shape across all phases.** Reporters, ranker, ticket-gen treat A.1-A.4 outputs identically. Phase isolation is enforced by registry (one ADR concern), not schema.
- **`schemaVersion: 1`** lets future evolution be additive. Consumers branch on the version, not on field presence.
- **ID derivation `sha256(probe|rule|file|line)[:16]`** is deterministic, so re-runs dedupe stably. `firstSeen` / `lastSeen` track recurrence without needing a separate persistence layer.
- **`vdiImpact` (quality / risk / readiness)** decouples severity (a property of the rule) from business impact (a property of the codebase). Lets the ranker weight findings against the VDI North Star without re-classifying severity.
- **Per-probe sidecar files** (`audits/<runId>/per-probe/<probe>.json`) keep each probe's output independently consumable, so downstream tooling can subscribe to one probe's stream without parsing the merged queue.
- **Meta-findings** (`_probe.crash`, `_probe.timeout`) reuse the same Finding shape with `confidence: 0` and `severity: "low"`, so probe failures appear in the queue without polluting real findings.

## Out of scope

- Phase A.5 (Electron renderer audit) introduces no schema change. Existing `Phase` union extends with `"A.5"`; all other fields remain.
- Cross-run trend reporting (`firstSeen` / `lastSeen` aggregation across multiple `audits/<runId>/` directories) is a separate concern — owned by future trend-reporter work, not the Finding shape itself.
- Severity weights and surface weights live in `ranker.config.ts`; they are tuning knobs, not schema.
