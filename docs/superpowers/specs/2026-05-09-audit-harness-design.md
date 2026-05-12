# Audit Harness — Design Spec

Date: 2026-05-09
Author: brainstormed via `/sp-brainstorming` (agisota + Claude)
Status: Draft, pending user approval before transition to `writing-plans`
Sub-project: **A** (of the A → B → D → C sequence for "comprehensive improvements")
Successor specs (to be brainstormed after A ships): B (composer deep-polish), D (a11y + perf budgets), C (Experience screens overhaul)

## 1. Overview

Sub-project A builds an audit harness that catalogs every UI/UX defect and code-quality regression across the four user-facing surfaces of the ROX ONE Agent Workbench Suite, ranks the findings against the VDI North Star, and emits a triage queue plus AGENTS.md-compliant ticket stubs that `/team 5:executor` agents drain in subsequent sub-projects.

The audit does not fix anything. It only catalogs and ranks. Fixes happen in B, C, and D.

The ranked queue replaces the current "improve it all" framing with concrete, evidence-backed work items: each finding is reproducible, scoped, and has measurable acceptance criteria.

## 2. Goals & Non-Goals

### 2.1 Goals
- Produce a stable, schema-versioned JSON triage queue consumable by autonomous executor agents.
- Generate per-defect ticket stubs in `docs/tickets/T<N>-<slug>.md` that conform to the AGENTS.md operating contract.
- Cover the four user-facing UI surfaces (renderer, webui, viewer, marketing) end-to-end across four probe families: static, runtime/a11y, LLM taste, E2E user flows.
- Ship phased so sub-project B can begin draining the queue after A.1 lands (~2 days from start).
- Be deterministic: same codebase state → same queue ordering across runs.

### 2.2 Non-Goals
- ❌ Fixing any defect (deferred to B, C, D).
- ❌ CI gating against regressions (deferred to D).
- ❌ Backend / `packages/server/*` probes (different defect model, out of "user-facing UIs").
- ❌ i18n parity audit (already covered by `lint:i18n:parity` and `lint:i18n:coverage`).
- ❌ SEO / Lighthouse-Best-Practices probes for the marketing site (deferred to D).
- ❌ Replacing or refactoring `scripts/validate-*.ts` (audit is additive, not a substitute).

## 3. Surfaces in Scope

| Surface | Path | Notes |
|---|---|---|
| Electron renderer | `apps/electron/src/renderer/**` | Primary product UI |
| Web UI | `apps/webui/**` | Browser thin-client for headless server |
| Session viewer | `apps/viewer/**` | Read-only session viewer (no E2E flows) |
| Marketing | `apps/marketing/**` | Landing site (no E2E flows, no runtime-states probe) |

`apps/cli` and all of `packages/*` are **out of scope** for this audit.

## 4. Architecture

### 4.1 Package Layout

```
packages/audit/
├── package.json           # Bun workspace member, name: "audit"
├── tsconfig.json          # extends tsconfig.base.json
├── src/
│   ├── probe.ts           # Probe interface, Finding type, FindingSeverity enum
│   ├── registry.ts        # ProbeRegistry: register(), run(), runOne()
│   ├── ranker.ts          # rank(findings) → ordered queue (pure function)
│   ├── ticket-gen.ts      # finding → AGENTS.md-formatted T<N>-<slug>.md
│   ├── schema/
│   │   ├── finding.schema.json
│   │   └── queue.schema.json
│   ├── probes/
│   │   ├── static-tsc.ts          # A.1
│   │   ├── static-eslint.ts       # A.1
│   │   ├── static-bundle.ts       # A.1
│   │   ├── runtime-axe.ts         # A.2
│   │   ├── runtime-states.ts      # A.2
│   │   ├── taste-llm.ts           # A.3
│   │   └── e2e-flows.ts           # A.4
│   ├── runners/
│   │   ├── playwright-runner.ts   # Shared by runtime-* and e2e-flows
│   │   └── llm-runner.ts          # Anthropic SDK with prompt caching
│   ├── reporters/
│   │   ├── json-queue.ts
│   │   └── markdown-sidecar.ts
│   └── cli.ts                     # `audit run <surfaces> [--probes=...]`
├── tests/                          # Mirrors src/, every module has tests
│   ├── fixtures/
│   │   ├── tsc-broken/
│   │   ├── eslint-broken/
│   │   ├── axe-broken/
│   │   └── bundle-bloated/
│   └── ...
└── README.md
```

### 4.2 Component Responsibilities

| Component | Owns |
|---|---|
| `Probe` interface | The contract every probe implements: `name`, `phase`, `applicableTo(surface)`, `run(ctx) → Finding[]` |
| `registry` | Probe discovery, filtering by `--probes=` flag, parallel execution with worker cap, timeout & crash isolation |
| `ranker` | Pure function: `Finding[]` → ordered queue. Severity × surface-importance × probe-confidence + VDI bonus |
| `ticket-gen` | One Finding → one ticket markdown file. Idempotent across re-runs |
| `playwright-runner` | Centralized Playwright setup with deterministic clock, viewport, fonts. Reuses existing `apps/electron` Playwright deps |
| `llm-runner` | Anthropic SDK client with prompt caching, `temperature: 0`, screenshot-hash keying |
| `reporters` | Pluggable output formatters: JSON queue (canonical), Markdown sidecar (human-readable) |
| `cli` | Entry point. Argument parsing, registry invocation, reporter dispatch. ~150 LOC |

### 4.3 The Probe Interface (load-bearing contract)

```typescript
type Surface = "renderer" | "webui" | "viewer" | "marketing";
type Phase = "A.1" | "A.2" | "A.3" | "A.4";
type FindingSeverity = "critical" | "high" | "medium" | "low";

interface Probe {
  name: string;                    // e.g. "static-tsc", "runtime-axe"
  phase: Phase;
  applicableTo(surface: Surface): boolean;
  run(ctx: ProbeContext): Promise<Finding[]>;
}

interface ProbeContext {
  surface: Surface;
  workspaceRoot: string;
  surfaceRoot: string;
  buildOutputRoot?: string;        // populated by static-bundle for bundle probes
  playwright?: PlaywrightInstance; // populated for runtime-* and e2e-* probes
  llm?: LLMClient;                 // populated for taste-llm
  timeoutMs: number;               // default 60_000, override per probe
}

interface Finding {
  schemaVersion: 1;
  id: string;                      // stable hash(probe + location + ruleId)
  probe: string;
  surface: Surface;
  phase: Phase;
  severity: FindingSeverity;
  rule: string;                    // e.g. "axe:button-name", "tsc:TS2345"
  location: { file: string; line?: number; column?: number; selector?: string; route?: string };
  message: string;
  evidence?: { screenshot?: string; codeSnippet?: string; consoleLog?: string };
  suggestedFix?: string;
  confidence: number;              // 0..1, probes that may produce false positives report < 1
  vdiImpact: { quality: number; risk: number; readiness: number };  // 0..1 each
  firstSeen: string;               // ISO 8601, set on first appearance, preserved across re-runs
  lastSeen: string;                // ISO 8601, updated each run
}
```

`schemaVersion: 1` covers all of A.1–A.4. Adding fields is non-breaking (consumers ignore unknown). Removing/renaming = `schemaVersion: 2` with explicit `audit migrate` command. **The `audit migrate` command is not delivered in any of the A.1–A.4 tickets** — it's added only if and when a v2 schema is needed (post-A, in a future spec).

## 5. Data Flow

```
[probe.run(ctx)] ─► Finding[] ─► registry merge ──┬─ json-queue reporter ─► audits/<date>/queue.json
   (each probe)                  (all probes)     │
                                       │          ├─ markdown reporter    ─► audits/<date>/queue.md
                                       ▼          │
                                   ranker.rank()  └─ ticket-gen           ─► docs/tickets/T<N>-<slug>.md
                                       │                                       (top-K only, default 50)
                                  ordered Finding[]
```

### 5.1 Output Artifacts Per Run

```
audits/2026-05-09T11-30-00Z/                # GITIGNORED (raw artifacts)
├── queue.json                              # ALL findings, ordered
├── queue.md                                # human-readable sidecar
├── per-probe/
│   ├── static-tsc.json
│   └── ...
└── manifest.json                           # written LAST; existence = run is committed-to-disk

docs/tickets/                                # COMMITTED (agent-facing)
├── T134-static-tsc-no-implicit-any-renderer.md
├── T135-runtime-axe-button-name-webui-settings.md
└── ...

docs/audits/INDEX.md                         # COMMITTED, append-only log
```

### 5.2 Idempotency Invariant

```
Run 1: Finding(id=abc) → docs/tickets/T134 created
Run 2: Finding(id=abc) still present → ticket-gen sees existing T134, no-op
       Finding(id=def) is new        → docs/tickets/T135 created
Run 3: Finding(id=abc) GONE          → T134 marked status: auto-resolved via frontmatter
                                        agents stop seeing it in active queue
```

Tickets carry frontmatter: `findingId`, `firstSeen`, `lastSeen`, `status: open | auto-resolved`. `firstSeen` / `lastSeen` are mirrored from the corresponding `Finding` (which is the source of truth) — ticket-gen copies, never invents.

The next-ticket-number allocator scans `docs/tickets/T<N>-*.md` for the highest existing N and increments. A.1 begins at T134 (highest existing as of 2026-05-09 is T128 in tickets/, T130 in worklog/).

### 5.3 Output Integrity

- All artifact writes are `tmp + rename + fsync`. Ctrl+C mid-write never leaves corrupt JSON.
- `manifest.json` is written last. Consumers (ticket-gen, downstream agents) only read runs whose manifest exists.

## 6. Ranking Algorithm

Pure deterministic function:

```
score(f) = severityWeight[f.severity]      // critical=1000, high=100, medium=10, low=1
         × surfaceWeight[f.surface]         // renderer=4, webui=3, viewer=2, marketing=1
         × f.confidence                     // 0..1
         + vdiBonus(f.vdiImpact)            // small additive boost: max +50 for vdiImpact={1,1,1}

sort findings by score DESC, ties broken by id ASC (stable across runs)
```

Weights live in `packages/audit/src/ranker.config.ts` — edited by hand, not user-flag-tunable, to keep ranking stable across runs. Weight changes are reviewable PRs.

## 7. Surface ↔ Probe Applicability Matrix

|  | static-tsc | static-eslint | static-bundle | runtime-axe | runtime-states | taste-llm | e2e-flows |
|---|---|---|---|---|---|---|---|
| renderer | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| webui | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| viewer | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| marketing | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ |

`Probe.applicableTo(surface)` returns the cell value. Skipping non-applicable cells is silent.

## 8. Error Handling

### 8.1 Per-Probe Failures
- Timeout (default 60s, per-probe override) → emit `Finding{rule:"_probe.timeout", confidence:0}`.
- Thrown error → emit `Finding{rule:"_probe.crash", confidence:0}`, full stack to `per-probe/<probe>.json`.
- Either case: probe failure never aborts the run. Zero-confidence findings are filtered out of the actionable queue but retained for debugging.

### 8.2 Per-Run Failures
- Probes run in parallel up to a worker cap (default 4, configurable for CI vs local).
- One probe's crash never affects siblings — process isolation via `Bun.spawn` for native tools, in-process try/catch for TS probes.
- If >50% of probes crash, the run aborts and writes `manifest.json{status:"aborted",reason:"too-many-probe-failures"}`.

## 9. Anti-Flake Measures

| Failure mode | Mitigation |
|---|---|
| Playwright network timing | `runtime-states` waits for `networkidle` + custom `data-ready` attribute, no arbitrary sleeps |
| LLM taste pass non-determinism | `temperature: 0` + prompt caching keyed on screenshot SHA-256; same screenshot → same output across runs |
| Bundle-size flakes from build cache | `static-bundle` does a clean build (`rm -rf dist && bun run build`) before measuring |
| Electron renderer screenshot variance | Pinned viewport (1440×900), forced font, `prefers-reduced-motion: reduce` |
| axe-core time-of-day issues | Frozen `Date.now` via Playwright clock control during runtime probes |

## 10. Testing Strategy (per AGENTS.md TDD contract)

Per `AGENTS.md`: "Never implement feature code before writing the relevant tests or validation checks."

### 10.1 Per-Probe Tests
For every probe, three test layers — written **before** the probe's production code:
- **Unit:** probe with mocked tool output → known `Finding[]` (golden file).
- **Unit:** timeout handling → emits zero-confidence finding.
- **Integration:** probe against a hermetic fixture project under `tests/fixtures/<probe>-broken/` → asserts specific rules detected.

### 10.2 Registry Tests
- One probe registered, runs, returns findings → assert wired up.
- Two probes, one crashes → assert the other still runs, crash logged.
- Worker cap = 1, three probes → assert serial execution.

### 10.3 Ranker Tests (pure function)
- Golden tests: synthetic `Finding[]` → expected order.
- Invariant tests: same input → same output.
- Property test: appending a low-severity finding never reorders existing top-K.

### 10.4 Ticket-Gen Tests (idempotency is load-bearing)
- Run on N findings, count generated tickets = N.
- Re-run on same N findings, count of new tickets = 0.
- Modify a finding's `lastSeen`, re-run → ticket markdown updates, file count unchanged.
- Remove a finding from input, re-run → corresponding ticket gets `status: auto-resolved` frontmatter.

### 10.5 CLI Smoke Tests
- `audit run renderer --probes=static-tsc` against fixture → exit 0, queue.json present.
- `audit run` without surfaces → exit 1 with helpful error.
- `audit migrate` from v1 schema fixture → produces v2 output (when v2 exists).

### 10.6 Coverage Gate
- ≥80% branch coverage on `packages/audit/`. Bun coverage reporter wired into `validate:ci`. CI fails below 80%.

## 11. Phasing & Tickets

### 11.1 Phase A.1 — Static Probes (~2 days, T134–T138)
| Ticket | Deliverable |
|---|---|
| T134 | `packages/audit/` workspace bootstrap, `Probe` interface, registry, CLI skeleton, ranker, JSON reporter |
| T135 | `static-tsc` probe + tests + fixture |
| T136 | `static-eslint` probe + tests + fixture |
| T137 | `static-bundle` probe + tests + fixture |
| T138 | `ticket-gen` + idempotency tests + first end-to-end run |

**A.1 acceptance gate:** `bun run audit run renderer,webui,viewer,marketing --probes=static-*` produces queue.json with real findings; ticket stubs land in `docs/tickets/`; all tests green; ≥80% branch coverage; `validate:ci` still passes.

### 11.2 Phase A.2 — Runtime Probes (~3 days, T065–T067)
| Ticket | Deliverable |
|---|---|
| T065 | `playwright-runner` shared infrastructure + tests (deterministic clock, viewport, fonts) |
| T066 | `runtime-axe` probe (per-route axe-core via Playwright) + fixture |
| T067 | `runtime-states` probe (asserts every interactive component renders empty/loading/error variants) + fixture |

**A.2 acceptance gate:** Runtime probes green against the four UI surfaces; queue grows with axe-core findings; no Playwright flakes across 5 consecutive CI runs.

### 11.3 Phase A.3 — LLM Taste Pass (~3 days, T068–T069)
| Ticket | Deliverable |
|---|---|
| T068 | `llm-runner` (Anthropic SDK with prompt caching, deterministic config) + tests |
| T069 | `taste-llm` probe (per-screenshot Sonnet pass) + screenshot-hash cache + tests |

**A.3 acceptance gate:** Same screenshot input → byte-identical findings output across runs (proves determinism). Taste findings clearly labeled `probe: "taste-llm"` so consumers can filter.

### 11.4 Phase A.4 — E2E User-Flow Probes (~5 days, T070–T076)
| Ticket | Deliverable |
|---|---|
| T070 | E2E flow framework: declarative flow spec format + flow-runner |
| T071 | Flow: "create session → send message → see response" (renderer + webui) |
| T072 | Flow: "attach file → send → see attachment in transcript" |
| T073 | Flow: "switch composer mode → send → mode persists" |
| T074 | Flow: "open Experience screen → navigate Mission Control → run a mission" |
| T075 | Flow: "marketing landing → click CTA → reach correct route" |
| T076 | Ranker calibration pass against accumulated A.1–A.4 queue, document weights |

**A.4 acceptance gate:** All 5 flows green; full audit run (all phases, all surfaces) completes in ≤10 min on dev machine; queue.json passes JSON Schema validation; ranker output stable across 3 consecutive runs.

## 12. Per-Ticket Worklog Format (mandated by AGENTS.md)

Each ticket ships with `docs/worklog/T<N>-<slug>.md` containing the 11 sections AGENTS.md requires:

1. Task summary
2. Repo context discovered
3. Files inspected
4. Tests added first
5. Expected failing test output
6. Implementation changes
7. Validation commands run
8. Passing test output summary
9. Build output summary
10. Remaining risks
11. Acceptance criteria matrix

`packages/audit/scripts/new-worklog.sh <ticket-id>` (delivered in T134) scaffolds this template.

## 13. Branching & Commits

- Each phase branches from `main`: `feat/audit-a1-static`, `feat/audit-a2-runtime`, `feat/audit-a3-taste`, `feat/audit-a4-e2e`.
- Phase ships as one PR (multi-commit, atomic per ticket).
- Conventional Commits: `feat(audit):`, `test(audit):`, `docs(audit):`.
- A.1's PR also adds `bun run audit` to root `package.json` scripts and a `# Audit harness` section to root `README.md`.

## 14. Definition of Done — Sub-Project A

- [ ] All four phases (A.1–A.4) merged to main.
- [ ] ≥80% branch coverage on `packages/audit/`.
- [ ] `validate:ci` includes audit smoke test (a tiny audit run, not full).
- [ ] First full audit run committed to `docs/audits/INDEX.md` with row pointing at queue.json + ticket stubs.
- [ ] Up to 50 ticket stubs (per the top-K cap from §5) sitting in `docs/tickets/` ready for `/team 5:executor`. Fewer is fine if the queue is small; more is not — overflow stays in `queue.json` only.
- [ ] `architect` agent verification pass (per OMC verification protocol — verifier in separate context, not the implementer).

## 15. Handoff Into Sub-Project B

When A is done, sub-project B (composer deep-polish) starts by:
1. Filtering `audits/<latest>/queue.json` for `surface: "renderer"` AND `location.file` matching `apps/electron/src/renderer/composer/**`.
2. Brainstorming B's design against that real evidence.
3. `/team 5:executor` drains the filtered queue.

Sub-projects D and C follow the same handoff pattern with their own `surface` / `location.file` filters.

## 16. Open Questions / Risks

- **Ranker weight calibration (T076)**: the initial weights (`severity` × `surface` × `confidence` + `vdiBonus`) are educated guesses. T076 is an explicit calibration pass against the accumulated A.1–A.4 queue; expect at least one round of adjustment after seeing real findings.
- **LLM taste cost ceiling**: each `taste-llm` run sends ~N screenshots × Sonnet input cost. At 50 routes × 4 surfaces × screenshot tokens, a single full audit could cost $5–$15. Prompt caching mitigates re-runs; the spec assumes audits run on-demand (a few times per week), not on every commit. If cost becomes a concern, A.3 ships behind an opt-in flag.
- **Playwright integration with Electron renderer**: the renderer runs inside Electron, not a vanilla browser. `runtime-axe` and `e2e-flows` for `renderer` need `playwright-electron` (already a transitive dep via `apps/electron`'s test setup). Risk: Electron version skew during upgrades; mitigation: integration tests against a packaged build.
- **Ticket flooding**: top-K=50 is the cap to prevent flooding `docs/tickets/`. If A.1's first run produces >>50 critical findings, we pause and triage manually before generating more ticket files.

---

*End of design spec. Next step on approval: `writing-plans` skill produces the implementation plan.*
