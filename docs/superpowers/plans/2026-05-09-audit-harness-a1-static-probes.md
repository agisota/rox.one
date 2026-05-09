# Audit Harness — Phase A.1 Static Probes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the `packages/audit/` workspace with a plugin-based `Probe` interface, registry, ranker, JSON+Markdown reporters, CLI entrypoint, idempotent ticket-gen, and three static probes (`static-tsc`, `static-eslint`, `static-bundle`). End state: `bun run audit run renderer,webui,viewer,marketing --probes=static-*` produces a real `queue.json` plus AGENTS.md-format ticket stubs in `docs/tickets/`.

**Architecture:** Bun workspace package. Each probe implements a `Probe` interface (`name`, `phase`, `applicableTo(surface)`, `run(ctx) → Finding[]`). A registry runs probes in parallel with per-probe timeout + crash isolation. A pure ranker orders findings by `severity × surfaceWeight × confidence + vdiBonus`. Output: schema-versioned `audits/<date>/queue.json` (canonical) + Markdown sidecar (human) + idempotent `docs/tickets/T<N>-<slug>.md` stubs (top-K=50, agent-facing).

**Tech Stack:** Bun 1.3.13, TypeScript 5.9 (strict), `bun:test` (built-in test runner with `expect`/`describe`/`test`), Node `crypto` for hash IDs, `js-yaml` (already in repo deps) for ticket frontmatter. No new production dependencies for A.1.

**Reference:** Spec `docs/superpowers/specs/2026-05-09-audit-harness-design.md` (commit `fae6237`). AGENTS.md TDD operating contract is mandatory — every probe and component has tests written before implementation.

---

## File Structure

### Created in this phase

| Path | Responsibility |
|---|---|
| `packages/audit/package.json` | Bun workspace manifest, name `audit` |
| `packages/audit/tsconfig.json` | Extends `tsconfig.base.json`, strict mode |
| `packages/audit/src/probe.ts` | `Probe` interface, `Finding` type, `FindingSeverity`, `Surface`, `Phase` enums, schema constants |
| `packages/audit/src/registry.ts` | `ProbeRegistry`: register/run/runOne with parallelism, timeout, crash isolation |
| `packages/audit/src/ranker.ts` | Pure `rank(findings)` function + `ranker.config.ts` for weights |
| `packages/audit/src/ranker.config.ts` | Severity / surface / VDI weights (hand-edited, reviewable) |
| `packages/audit/src/ticket-gen.ts` | Finding → AGENTS.md ticket markdown, idempotent across re-runs |
| `packages/audit/src/probes/static-tsc.ts` | Wraps `tsc --noEmit` per surface, parses diagnostics → findings |
| `packages/audit/src/probes/static-eslint.ts` | Wraps `eslint --format=json` per surface, parses → findings |
| `packages/audit/src/probes/static-bundle.ts` | Builds surface, measures bundle size against budget, emits findings |
| `packages/audit/src/reporters/json-queue.ts` | Writes `audits/<date>/queue.json` + `manifest.json` (atomic tmp+rename) |
| `packages/audit/src/reporters/markdown-sidecar.ts` | Writes `audits/<date>/queue.md` (severity-grouped) |
| `packages/audit/src/schema/finding.schema.json` | JSON Schema v1 for the `Finding` type |
| `packages/audit/src/schema/queue.schema.json` | JSON Schema v1 for the queue file |
| `packages/audit/src/cli.ts` | Argument parsing, registry invocation, reporter dispatch |
| `packages/audit/scripts/new-worklog.sh` | Scaffolds `docs/worklog/T<N>-<slug>.md` from AGENTS.md template |
| `packages/audit/tests/probe.test.ts` | Tests `Finding` shape invariants, hash-id stability |
| `packages/audit/tests/registry.test.ts` | Tests register/run/parallelism/crash isolation |
| `packages/audit/tests/ranker.test.ts` | Pure-function golden tests + invariants |
| `packages/audit/tests/ticket-gen.test.ts` | Idempotency invariants |
| `packages/audit/tests/probes/static-tsc.test.ts` | Probe against `tsc-broken/` fixture |
| `packages/audit/tests/probes/static-eslint.test.ts` | Probe against `eslint-broken/` fixture |
| `packages/audit/tests/probes/static-bundle.test.ts` | Probe against `bundle-bloated/` fixture |
| `packages/audit/tests/reporters/json-queue.test.ts` | Atomic write, manifest written last |
| `packages/audit/tests/reporters/markdown-sidecar.test.ts` | Severity grouping correctness |
| `packages/audit/tests/cli.test.ts` | CLI smoke tests against fixtures |
| `packages/audit/tests/fixtures/tsc-broken/` | Hermetic fixture: 3 known TS errors |
| `packages/audit/tests/fixtures/eslint-broken/` | Hermetic fixture: 2 known eslint violations |
| `packages/audit/tests/fixtures/bundle-bloated/` | Hermetic fixture: pre-built dist exceeding 200KB |
| `packages/audit/README.md` | Package README — usage, probe contract, extension guide |
| `docs/tickets/T060-bootstrap-audit-package.md` | Ticket file (AGENTS.md format) |
| `docs/tickets/T061-static-tsc-probe.md` | Ticket file |
| `docs/tickets/T062-static-eslint-probe.md` | Ticket file |
| `docs/tickets/T063-static-bundle-probe.md` | Ticket file |
| `docs/tickets/T064-ticket-gen-and-first-run.md` | Ticket file |
| `docs/worklog/T060-bootstrap-audit-package.md` | Worklog (11-section AGENTS.md format) |
| `docs/worklog/T061-static-tsc-probe.md` | Worklog |
| `docs/worklog/T062-static-eslint-probe.md` | Worklog |
| `docs/worklog/T063-static-bundle-probe.md` | Worklog |
| `docs/worklog/T064-ticket-gen-and-first-run.md` | Worklog |
| `docs/audits/INDEX.md` | Append-only audit log (created on first run) |
| `audits/` | Created by first run (gitignored) |

### Modified in this phase

| Path | Change |
|---|---|
| `package.json` (root) | Add `"audit": "bun run packages/audit/src/cli.ts"` to scripts; add `"validate:audit"` smoke; add `bun run validate:audit` to `validate:ci` chain |
| `README.md` (root) | Add `## Audit harness` section pointing to `packages/audit/README.md` |
| `tsconfig.json` (root) | Add reference for `packages/audit` (if existing project-references pattern is followed; otherwise no-op) |
| `.gitignore` (root) | Add `audits/` (raw run artifacts) |

### Branch & commit policy

- All work on branch `feat/audit-a1-static` (already created/checked out by the engineer before starting Task 1, or branched from current `feat/audit-harness-spec`).
- One commit per task per the user's engineering rules (atomic commits, Conventional Commits format).
- Commit identity: per-commit flags `-c user.name="Mark Lindgreen" -c user.email="mark@agisota.com"` (matches repo history).
- Do not push until Phase A.1 acceptance gate passes.

---

## Task 1: Bootstrap workspace package

**Files:**
- Create: `packages/audit/package.json`
- Create: `packages/audit/tsconfig.json`
- Create: `packages/audit/README.md`
- Modify: `package.json` (root) — add to workspaces if not already covered by `"packages/*"` glob (it is, so no manual edit needed)

- [ ] **Step 1: Create the package manifest**

Create `packages/audit/package.json`:

```json
{
  "name": "audit",
  "version": "0.9.1",
  "private": true,
  "type": "module",
  "main": "./src/cli.ts",
  "scripts": {
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "js-yaml": "^4.1.1"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^25.6.0",
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 2: Create the package tsconfig**

Create `packages/audit/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "noImplicitAny": true,
    "moduleResolution": "bundler",
    "types": ["bun"]
  },
  "include": ["src/**/*", "tests/**/*"],
  "exclude": ["dist", "tests/fixtures/**"]
}
```

- [ ] **Step 3: Create a placeholder README**

Create `packages/audit/README.md`:

```markdown
# audit

Audit harness for the ROX ONE Agent Workbench Suite. See spec `docs/superpowers/specs/2026-05-09-audit-harness-design.md`.

Phase A.1 (this phase): static probes only — `static-tsc`, `static-eslint`, `static-bundle`.
Phase A.2: runtime + axe-core (later).
Phase A.3: LLM taste pass (later).
Phase A.4: E2E user-flow probes (later).

## Usage (after A.1 ships)

\`\`\`
bun run audit run <surfaces> [--probes=<csv>]
bun run audit run renderer --probes=static-tsc
bun run audit run renderer,webui,viewer,marketing --probes=static-*
\`\`\`

Output:
- `audits/<date>/queue.json` — canonical, schema-versioned (gitignored)
- `audits/<date>/queue.md` — human-readable sidecar (gitignored)
- `docs/tickets/T<N>-*.md` — top-50 ticket stubs (committed)
- `docs/audits/INDEX.md` — append-only audit log (committed)
```

- [ ] **Step 4: Verify package is discovered by Bun workspaces**

Run: `bun pm ls --workspaces 2>&1 | grep audit`
Expected: line containing `audit@0.9.1`

- [ ] **Step 5: Install workspace deps**

Run from repo root: `bun install`
Expected: no errors. `node_modules/audit` symlink appears (verify with `ls -la node_modules/audit`).

- [ ] **Step 6: Verify the package typechecks (no source files yet — should be vacuous)**

Run from repo root: `cd packages/audit && bun run typecheck`
Expected: exits 0 with no output (no source to check yet).

- [ ] **Step 7: Add `audits/` to root .gitignore**

Modify `.gitignore` (root). Add at the end:

```
# Audit harness raw run artifacts (committed: docs/tickets, docs/audits/INDEX.md only)
audits/
```

- [ ] **Step 8: Commit**

```bash
cd /home/dev/rox/rox-one-terminal
git add packages/audit/package.json packages/audit/tsconfig.json packages/audit/README.md .gitignore
git -c user.name="Mark Lindgreen" -c user.email="mark@agisota.com" commit -m "feat(audit): bootstrap packages/audit workspace [T060]"
```

---

## Task 2: Probe interface + Finding type (TDD)

**Files:**
- Create: `packages/audit/src/probe.ts`
- Create: `packages/audit/tests/probe.test.ts`

- [ ] **Step 1: Write the failing test for stable hash-id derivation**

Create `packages/audit/tests/probe.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { computeFindingId, type Finding } from "../src/probe.ts";

describe("computeFindingId", () => {
  test("same probe + location + rule → same id across calls", () => {
    const a = computeFindingId({ probe: "static-tsc", rule: "TS2345", file: "x.ts", line: 10 });
    const b = computeFindingId({ probe: "static-tsc", rule: "TS2345", file: "x.ts", line: 10 });
    expect(a).toBe(b);
  });

  test("different rule → different id", () => {
    const a = computeFindingId({ probe: "static-tsc", rule: "TS2345", file: "x.ts", line: 10 });
    const b = computeFindingId({ probe: "static-tsc", rule: "TS2322", file: "x.ts", line: 10 });
    expect(a).not.toBe(b);
  });

  test("different file → different id", () => {
    const a = computeFindingId({ probe: "static-tsc", rule: "TS2345", file: "x.ts", line: 10 });
    const b = computeFindingId({ probe: "static-tsc", rule: "TS2345", file: "y.ts", line: 10 });
    expect(a).not.toBe(b);
  });

  test("id is 16 hex chars (truncated SHA-256)", () => {
    const id = computeFindingId({ probe: "static-tsc", rule: "TS2345", file: "x.ts", line: 10 });
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("Finding shape", () => {
  test("Finding can be constructed with all required fields", () => {
    const f: Finding = {
      schemaVersion: 1,
      id: "abcd1234abcd1234",
      probe: "static-tsc",
      surface: "renderer",
      phase: "A.1",
      severity: "high",
      rule: "TS2345",
      location: { file: "src/foo.ts", line: 10 },
      message: "Argument of type X is not assignable to Y",
      confidence: 1,
      vdiImpact: { quality: 0.7, risk: 0.3, readiness: 0.5 },
      firstSeen: "2026-05-09T11:00:00Z",
      lastSeen: "2026-05-09T11:00:00Z",
    };
    expect(f.schemaVersion).toBe(1);
    expect(f.surface).toBe("renderer");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run from repo root: `cd packages/audit && bun test tests/probe.test.ts`
Expected: FAIL with "Cannot find module '../src/probe.ts'" or equivalent.

- [ ] **Step 3: Write minimal `src/probe.ts` to make tests pass**

Create `packages/audit/src/probe.ts`:

```typescript
import { createHash } from "node:crypto";

export type Surface = "renderer" | "webui" | "viewer" | "marketing";
export type Phase = "A.1" | "A.2" | "A.3" | "A.4";
export type FindingSeverity = "critical" | "high" | "medium" | "low";

export const FINDING_SCHEMA_VERSION = 1 as const;

export interface ProbeContext {
  surface: Surface;
  workspaceRoot: string;
  surfaceRoot: string;
  buildOutputRoot?: string;
  timeoutMs: number;
}

export interface Probe {
  readonly name: string;
  readonly phase: Phase;
  applicableTo(surface: Surface): boolean;
  run(ctx: ProbeContext): Promise<Finding[]>;
}

export interface FindingLocation {
  file: string;
  line?: number;
  column?: number;
  selector?: string;
  route?: string;
}

export interface FindingEvidence {
  screenshot?: string;
  codeSnippet?: string;
  consoleLog?: string;
}

export interface VdiImpact {
  quality: number;
  risk: number;
  readiness: number;
}

export interface Finding {
  schemaVersion: typeof FINDING_SCHEMA_VERSION;
  id: string;
  probe: string;
  surface: Surface;
  phase: Phase;
  severity: FindingSeverity;
  rule: string;
  location: FindingLocation;
  message: string;
  evidence?: FindingEvidence;
  suggestedFix?: string;
  confidence: number;
  vdiImpact: VdiImpact;
  firstSeen: string;
  lastSeen: string;
}

export interface FindingIdInput {
  probe: string;
  rule: string;
  file: string;
  line?: number;
}

export function computeFindingId(input: FindingIdInput): string {
  const key = [input.probe, input.rule, input.file, input.line ?? ""].join("|");
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/audit && bun test tests/probe.test.ts`
Expected: 4 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
cd /home/dev/rox/rox-one-terminal
git add packages/audit/src/probe.ts packages/audit/tests/probe.test.ts
git -c user.name="Mark Lindgreen" -c user.email="mark@agisota.com" commit -m "feat(audit): Probe interface + Finding type with stable id [T060]"
```

---

## Task 3: ProbeRegistry — basic register/run (TDD)

**Files:**
- Create: `packages/audit/src/registry.ts`
- Create: `packages/audit/tests/registry.test.ts`

- [ ] **Step 1: Write the failing test for register + run**

Create `packages/audit/tests/registry.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { ProbeRegistry } from "../src/registry.ts";
import type { Finding, Probe, ProbeContext, Surface } from "../src/probe.ts";

function makeProbe(name: string, findings: Finding[]): Probe {
  return {
    name,
    phase: "A.1",
    applicableTo: () => true,
    run: async () => findings,
  };
}

const ctxFor = (surface: Surface): ProbeContext => ({
  surface,
  workspaceRoot: "/tmp/ws",
  surfaceRoot: "/tmp/ws/x",
  timeoutMs: 60_000,
});

describe("ProbeRegistry — basic", () => {
  test("registered probe runs and returns its findings", async () => {
    const reg = new ProbeRegistry();
    const finding: Finding = {
      schemaVersion: 1,
      id: "aaaa1111aaaa1111",
      probe: "p1",
      surface: "renderer",
      phase: "A.1",
      severity: "high",
      rule: "X",
      location: { file: "f" },
      message: "m",
      confidence: 1,
      vdiImpact: { quality: 0, risk: 0, readiness: 0 },
      firstSeen: "2026-05-09T11:00:00Z",
      lastSeen: "2026-05-09T11:00:00Z",
    };
    reg.register(makeProbe("p1", [finding]));
    const result = await reg.run({ surfaces: ["renderer"], probes: ["p1"], workerCap: 1, contextFor: ctxFor });
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].id).toBe("aaaa1111aaaa1111");
  });

  test("filters probes by --probes selection", async () => {
    const reg = new ProbeRegistry();
    reg.register(makeProbe("p1", []));
    reg.register(makeProbe("p2", []));
    const result = await reg.run({ surfaces: ["renderer"], probes: ["p1"], workerCap: 1, contextFor: ctxFor });
    expect(result.runProbes).toEqual(["p1"]);
  });

  test("skips probes whose applicableTo() returns false for the surface", async () => {
    const reg = new ProbeRegistry();
    const onlyRenderer: Probe = {
      name: "only-renderer",
      phase: "A.1",
      applicableTo: (s) => s === "renderer",
      run: async () => [],
    };
    reg.register(onlyRenderer);
    const result = await reg.run({ surfaces: ["webui"], probes: ["only-renderer"], workerCap: 1, contextFor: ctxFor });
    expect(result.executedPairs).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/audit && bun test tests/registry.test.ts`
Expected: FAIL — `ProbeRegistry` not exported.

- [ ] **Step 3: Implement minimal `src/registry.ts`**

Create `packages/audit/src/registry.ts`:

```typescript
import type { Finding, Probe, ProbeContext, Surface } from "./probe.ts";

export interface RegistryRunOptions {
  surfaces: Surface[];
  probes: string[];
  workerCap: number;
  contextFor: (surface: Surface) => ProbeContext;
}

export interface RegistryRunResult {
  findings: Finding[];
  runProbes: string[];
  executedPairs: { probe: string; surface: Surface }[];
  crashed: { probe: string; surface: Surface; error: string }[];
}

export class ProbeRegistry {
  private probes = new Map<string, Probe>();

  register(probe: Probe): void {
    if (this.probes.has(probe.name)) {
      throw new Error(`Probe already registered: ${probe.name}`);
    }
    this.probes.set(probe.name, probe);
  }

  list(): Probe[] {
    return Array.from(this.probes.values());
  }

  async run(opts: RegistryRunOptions): Promise<RegistryRunResult> {
    const selected = opts.probes
      .map((name) => this.probes.get(name))
      .filter((p): p is Probe => p !== undefined);

    const pairs: { probe: Probe; surface: Surface }[] = [];
    for (const probe of selected) {
      for (const surface of opts.surfaces) {
        if (probe.applicableTo(surface)) pairs.push({ probe, surface });
      }
    }

    const allFindings: Finding[] = [];
    const crashed: RegistryRunResult["crashed"] = [];
    for (const { probe, surface } of pairs) {
      try {
        const ctx = opts.contextFor(surface);
        const findings = await probe.run(ctx);
        allFindings.push(...findings);
      } catch (e) {
        crashed.push({ probe: probe.name, surface, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return {
      findings: allFindings,
      runProbes: selected.map((p) => p.name),
      executedPairs: pairs.map(({ probe, surface }) => ({ probe: probe.name, surface })),
      crashed,
    };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/audit && bun test tests/registry.test.ts`
Expected: 3 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
cd /home/dev/rox/rox-one-terminal
git add packages/audit/src/registry.ts packages/audit/tests/registry.test.ts
git -c user.name="Mark Lindgreen" -c user.email="mark@agisota.com" commit -m "feat(audit): ProbeRegistry register + serial run [T060]"
```

---

## Task 4: ProbeRegistry — parallel execution with worker cap (TDD)

**Files:**
- Modify: `packages/audit/src/registry.ts` — add parallelism
- Modify: `packages/audit/tests/registry.test.ts` — add parallelism tests

- [ ] **Step 1: Write the failing parallelism test**

Append to `packages/audit/tests/registry.test.ts` (before the final `});` of the file if any, or just append a new `describe` block):

```typescript
describe("ProbeRegistry — parallelism", () => {
  test("workerCap=1 runs probes serially (proven by overlapping start times being impossible)", async () => {
    const reg = new ProbeRegistry();
    const log: string[] = [];
    const slow = (name: string): Probe => ({
      name,
      phase: "A.1",
      applicableTo: () => true,
      run: async () => {
        log.push(`${name}:start`);
        await new Promise((r) => setTimeout(r, 30));
        log.push(`${name}:end`);
        return [];
      },
    });
    reg.register(slow("p1"));
    reg.register(slow("p2"));
    await reg.run({ surfaces: ["renderer"], probes: ["p1", "p2"], workerCap: 1, contextFor: ctxFor });
    expect(log).toEqual(["p1:start", "p1:end", "p2:start", "p2:end"]);
  });

  test("workerCap=2 runs two probes in parallel (overlapping windows)", async () => {
    const reg = new ProbeRegistry();
    const log: string[] = [];
    const slow = (name: string): Probe => ({
      name,
      phase: "A.1",
      applicableTo: () => true,
      run: async () => {
        log.push(`${name}:start`);
        await new Promise((r) => setTimeout(r, 30));
        log.push(`${name}:end`);
        return [];
      },
    });
    reg.register(slow("p1"));
    reg.register(slow("p2"));
    await reg.run({ surfaces: ["renderer"], probes: ["p1", "p2"], workerCap: 2, contextFor: ctxFor });
    // Both should start before either ends
    const p1StartIdx = log.indexOf("p1:start");
    const p2StartIdx = log.indexOf("p2:start");
    const p1EndIdx = log.indexOf("p1:end");
    expect(p2StartIdx).toBeLessThan(p1EndIdx);
    expect(p1StartIdx).toBeLessThan(p1EndIdx);
  });
});
```

- [ ] **Step 2: Run the test to verify the parallelism test fails (or passes vacuously due to current sequential impl — depends on timing)**

Run: `cd packages/audit && bun test tests/registry.test.ts`
Expected: At minimum, the parallelism (`workerCap=2`) test fails because the current `for` loop runs serially.

- [ ] **Step 3: Replace the serial loop with a worker-pool implementation**

Modify `packages/audit/src/registry.ts`. Replace the `for (const { probe, surface } of pairs)` block in `run()` with:

```typescript
    const allFindings: Finding[] = [];
    const crashed: RegistryRunResult["crashed"] = [];
    const queue = [...pairs];
    const cap = Math.max(1, opts.workerCap);

    async function worker(): Promise<void> {
      while (queue.length > 0) {
        const next = queue.shift();
        if (!next) return;
        try {
          const ctx = opts.contextFor(next.surface);
          const findings = await next.probe.run(ctx);
          allFindings.push(...findings);
        } catch (e) {
          crashed.push({ probe: next.probe.name, surface: next.surface, error: e instanceof Error ? e.message : String(e) });
        }
      }
    }

    const workers = Array.from({ length: Math.min(cap, queue.length) }, () => worker());
    await Promise.all(workers);
```

- [ ] **Step 4: Run all registry tests**

Run: `cd packages/audit && bun test tests/registry.test.ts`
Expected: 5 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
cd /home/dev/rox/rox-one-terminal
git add packages/audit/src/registry.ts packages/audit/tests/registry.test.ts
git -c user.name="Mark Lindgreen" -c user.email="mark@agisota.com" commit -m "feat(audit): ProbeRegistry worker-pool parallelism [T060]"
```

---

## Task 5: ProbeRegistry — timeout + crash isolation (TDD)

**Files:**
- Modify: `packages/audit/src/registry.ts` — add per-probe timeout wrapping crashes into zero-confidence findings
- Modify: `packages/audit/tests/registry.test.ts` — add crash + timeout tests

- [ ] **Step 1: Write the failing tests for timeout + crash isolation**

Append to `packages/audit/tests/registry.test.ts`:

```typescript
describe("ProbeRegistry — error handling", () => {
  test("crashed probe emits zero-confidence finding, sibling still runs", async () => {
    const reg = new ProbeRegistry();
    const crasher: Probe = {
      name: "crasher",
      phase: "A.1",
      applicableTo: () => true,
      run: async () => { throw new Error("boom"); },
    };
    const ok: Probe = {
      name: "ok",
      phase: "A.1",
      applicableTo: () => true,
      run: async () => [],
    };
    reg.register(crasher);
    reg.register(ok);
    const result = await reg.run({ surfaces: ["renderer"], probes: ["crasher", "ok"], workerCap: 2, contextFor: ctxFor });
    const crashFinding = result.findings.find((f) => f.rule === "_probe.crash");
    expect(crashFinding).toBeDefined();
    expect(crashFinding?.confidence).toBe(0);
    expect(crashFinding?.message).toContain("boom");
    expect(result.crashed).toHaveLength(1);
  });

  test("probe timeout emits _probe.timeout finding", async () => {
    const reg = new ProbeRegistry();
    const slow: Probe = {
      name: "slow",
      phase: "A.1",
      applicableTo: () => true,
      run: async () => {
        await new Promise((r) => setTimeout(r, 200));
        return [];
      },
    };
    reg.register(slow);
    const result = await reg.run({
      surfaces: ["renderer"],
      probes: ["slow"],
      workerCap: 1,
      contextFor: (s) => ({ ...ctxFor(s), timeoutMs: 50 }),
    });
    const timeoutFinding = result.findings.find((f) => f.rule === "_probe.timeout");
    expect(timeoutFinding).toBeDefined();
    expect(timeoutFinding?.confidence).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/audit && bun test tests/registry.test.ts`
Expected: Crash test passes already (existing try/catch), but emits no zero-confidence finding (current impl just records to `crashed` array). Timeout test fails.

- [ ] **Step 3: Add a timeout wrapper + zero-confidence finding emitter**

Modify `packages/audit/src/registry.ts`. Add this helper above the `ProbeRegistry` class:

```typescript
import { computeFindingId, FINDING_SCHEMA_VERSION } from "./probe.ts";

function makeMetaFinding(
  probe: string,
  surface: Surface,
  rule: "_probe.timeout" | "_probe.crash",
  message: string,
): Finding {
  const now = new Date().toISOString();
  return {
    schemaVersion: FINDING_SCHEMA_VERSION,
    id: computeFindingId({ probe, rule, file: `<probe:${probe}>`, line: 0 }),
    probe,
    surface,
    phase: "A.1",
    severity: "low",
    rule,
    location: { file: `<probe:${probe}>` },
    message,
    confidence: 0,
    vdiImpact: { quality: 0, risk: 0, readiness: 0 },
    firstSeen: now,
    lastSeen: now,
  };
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<{ ok: true; value: T } | { ok: false; reason: "timeout" }> {
  return await Promise.race([
    promise.then((value) => ({ ok: true as const, value })),
    new Promise<{ ok: false; reason: "timeout" }>((resolve) =>
      setTimeout(() => resolve({ ok: false, reason: "timeout" }), ms),
    ),
  ]);
}
```

Then replace the worker body in `run()`:

```typescript
    async function worker(): Promise<void> {
      while (queue.length > 0) {
        const next = queue.shift();
        if (!next) return;
        const ctx = opts.contextFor(next.surface);
        const outcome = await withTimeout(
          (async () => next.probe.run(ctx))().catch((e) => {
            throw e instanceof Error ? e : new Error(String(e));
          }),
          ctx.timeoutMs,
        ).catch((e: Error) => ({ ok: false as const, reason: "crash" as const, err: e }));

        if (outcome.ok === true) {
          allFindings.push(...outcome.value);
        } else if (outcome.reason === "timeout") {
          allFindings.push(makeMetaFinding(next.probe.name, next.surface, "_probe.timeout", `probe exceeded ${ctx.timeoutMs}ms`));
          crashed.push({ probe: next.probe.name, surface: next.surface, error: "timeout" });
        } else {
          const msg = (outcome as { err: Error }).err.message;
          allFindings.push(makeMetaFinding(next.probe.name, next.surface, "_probe.crash", msg));
          crashed.push({ probe: next.probe.name, surface: next.surface, error: msg });
        }
      }
    }
```

- [ ] **Step 4: Run all registry tests**

Run: `cd packages/audit && bun test tests/registry.test.ts`
Expected: 7 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
cd /home/dev/rox/rox-one-terminal
git add packages/audit/src/registry.ts packages/audit/tests/registry.test.ts
git -c user.name="Mark Lindgreen" -c user.email="mark@agisota.com" commit -m "feat(audit): per-probe timeout + crash isolation with zero-confidence findings [T060]"
```

---

## Task 6: Ranker — pure function with golden tests (TDD)

**Files:**
- Create: `packages/audit/src/ranker.ts`
- Create: `packages/audit/src/ranker.config.ts`
- Create: `packages/audit/tests/ranker.test.ts`

- [ ] **Step 1: Write the failing tests for ranker behavior**

Create `packages/audit/tests/ranker.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { rank } from "../src/ranker.ts";
import type { Finding } from "../src/probe.ts";

const baseFinding = (overrides: Partial<Finding>): Finding => ({
  schemaVersion: 1,
  id: "0000000000000000",
  probe: "p",
  surface: "renderer",
  phase: "A.1",
  severity: "low",
  rule: "R",
  location: { file: "f" },
  message: "m",
  confidence: 1,
  vdiImpact: { quality: 0, risk: 0, readiness: 0 },
  firstSeen: "2026-05-09T11:00:00Z",
  lastSeen: "2026-05-09T11:00:00Z",
  ...overrides,
});

describe("rank()", () => {
  test("orders by severity descending", () => {
    const findings = [
      baseFinding({ id: "1111111111111111", severity: "low" }),
      baseFinding({ id: "2222222222222222", severity: "critical" }),
      baseFinding({ id: "3333333333333333", severity: "medium" }),
    ];
    const ranked = rank(findings);
    expect(ranked.map((f) => f.severity)).toEqual(["critical", "medium", "low"]);
  });

  test("renderer outranks webui at same severity", () => {
    const findings = [
      baseFinding({ id: "aaaa", surface: "webui", severity: "high" }),
      baseFinding({ id: "bbbb", surface: "renderer", severity: "high" }),
    ];
    const ranked = rank(findings);
    expect(ranked[0].surface).toBe("renderer");
  });

  test("zero confidence pushes finding to bottom regardless of severity", () => {
    const findings = [
      baseFinding({ id: "1111", severity: "critical", confidence: 0 }),
      baseFinding({ id: "2222", severity: "low", confidence: 1 }),
    ];
    const ranked = rank(findings);
    expect(ranked[0].id).toBe("2222");
  });

  test("ties broken by id ASCII order (stable)", () => {
    const findings = [
      baseFinding({ id: "ffff" }),
      baseFinding({ id: "aaaa" }),
      baseFinding({ id: "cccc" }),
    ];
    const ranked = rank(findings);
    expect(ranked.map((f) => f.id)).toEqual(["aaaa", "cccc", "ffff"]);
  });

  test("identical input produces identical output (determinism)", () => {
    const findings = [
      baseFinding({ id: "1111", severity: "high" }),
      baseFinding({ id: "2222", severity: "medium" }),
      baseFinding({ id: "3333", severity: "high", surface: "webui" }),
    ];
    const a = rank([...findings]);
    const b = rank([...findings]);
    expect(a.map((f) => f.id)).toEqual(b.map((f) => f.id));
  });

  test("appending a low-severity finding does not reorder existing top items", () => {
    const top = [
      baseFinding({ id: "aaaa", severity: "critical" }),
      baseFinding({ id: "bbbb", severity: "high" }),
    ];
    const original = rank(top);
    const extended = rank([...top, baseFinding({ id: "cccc", severity: "low" })]);
    expect(extended.slice(0, 2).map((f) => f.id)).toEqual(original.map((f) => f.id));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/audit && bun test tests/ranker.test.ts`
Expected: FAIL — `rank` not exported.

- [ ] **Step 3: Implement `ranker.config.ts` and `ranker.ts`**

Create `packages/audit/src/ranker.config.ts`:

```typescript
import type { FindingSeverity, Surface } from "./probe.ts";

// Hand-edited weights. Changes are reviewable PRs to keep ranking stable across runs.
export const RANKER_CONFIG = {
  severityWeight: {
    critical: 1000,
    high: 100,
    medium: 10,
    low: 1,
  } as Record<FindingSeverity, number>,
  surfaceWeight: {
    renderer: 4,
    webui: 3,
    viewer: 2,
    marketing: 1,
  } as Record<Surface, number>,
  vdiBonusMax: 50, // additive cap when vdiImpact = {1,1,1}
} as const;
```

Create `packages/audit/src/ranker.ts`:

```typescript
import type { Finding } from "./probe.ts";
import { RANKER_CONFIG } from "./ranker.config.ts";

export function score(f: Finding): number {
  const base =
    RANKER_CONFIG.severityWeight[f.severity] *
    RANKER_CONFIG.surfaceWeight[f.surface] *
    f.confidence;
  const vdiSum = (f.vdiImpact.quality + f.vdiImpact.risk + f.vdiImpact.readiness) / 3;
  return base + vdiSum * RANKER_CONFIG.vdiBonusMax;
}

export function rank(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    if (sa !== sb) return sb - sa; // descending by score
    return a.id.localeCompare(b.id); // stable tie-break
  });
}
```

- [ ] **Step 4: Run ranker tests**

Run: `cd packages/audit && bun test tests/ranker.test.ts`
Expected: 6 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
cd /home/dev/rox/rox-one-terminal
git add packages/audit/src/ranker.ts packages/audit/src/ranker.config.ts packages/audit/tests/ranker.test.ts
git -c user.name="Mark Lindgreen" -c user.email="mark@agisota.com" commit -m "feat(audit): pure ranker with severity/surface/confidence/VDI weights [T060]"
```

---

## Task 7: JSON queue reporter — atomic writes (TDD)

**Files:**
- Create: `packages/audit/src/reporters/json-queue.ts`
- Create: `packages/audit/tests/reporters/json-queue.test.ts`

- [ ] **Step 1: Write the failing tests for atomic JSON write + manifest-last invariant**

Create `packages/audit/tests/reporters/json-queue.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeJsonQueue } from "../../src/reporters/json-queue.ts";
import type { Finding } from "../../src/probe.ts";

let dir: string;

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "audit-test-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const f: Finding = {
  schemaVersion: 1,
  id: "1111111111111111",
  probe: "p",
  surface: "renderer",
  phase: "A.1",
  severity: "high",
  rule: "R",
  location: { file: "x" },
  message: "m",
  confidence: 1,
  vdiImpact: { quality: 0, risk: 0, readiness: 0 },
  firstSeen: "2026-05-09T11:00:00Z",
  lastSeen: "2026-05-09T11:00:00Z",
};

describe("writeJsonQueue", () => {
  test("writes queue.json with all findings", async () => {
    await writeJsonQueue({ outDir: dir, findings: [f], runId: "r1", probes: ["p"], surfaces: ["renderer"], durationMs: 100 });
    const queue = JSON.parse(readFileSync(join(dir, "queue.json"), "utf-8"));
    expect(queue.schemaVersion).toBe(1);
    expect(queue.findings).toHaveLength(1);
  });

  test("manifest.json is written last (after queue.json exists)", async () => {
    await writeJsonQueue({ outDir: dir, findings: [f], runId: "r1", probes: ["p"], surfaces: ["renderer"], durationMs: 100 });
    expect(existsSync(join(dir, "queue.json"))).toBe(true);
    expect(existsSync(join(dir, "manifest.json"))).toBe(true);
    const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf-8"));
    expect(manifest.runId).toBe("r1");
    expect(manifest.status).toBe("ok");
  });

  test("no .tmp files left behind after successful write", async () => {
    await writeJsonQueue({ outDir: dir, findings: [f], runId: "r1", probes: ["p"], surfaces: ["renderer"], durationMs: 100 });
    const tmps = readdirSync(dir).filter((n) => n.endsWith(".tmp"));
    expect(tmps).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd packages/audit && bun test tests/reporters/json-queue.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/reporters/json-queue.ts`**

Create `packages/audit/src/reporters/json-queue.ts`:

```typescript
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Finding, Surface } from "../probe.ts";
import { FINDING_SCHEMA_VERSION } from "../probe.ts";

export interface WriteJsonQueueInput {
  outDir: string;
  findings: Finding[];
  runId: string;
  probes: string[];
  surfaces: Surface[];
  durationMs: number;
}

function atomicWriteJson(path: string, data: unknown): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, path);
}

export async function writeJsonQueue(input: WriteJsonQueueInput): Promise<void> {
  mkdirSync(input.outDir, { recursive: true });

  const queue = {
    schemaVersion: FINDING_SCHEMA_VERSION,
    runId: input.runId,
    generatedAt: new Date().toISOString(),
    findingCount: input.findings.length,
    findings: input.findings,
  };
  atomicWriteJson(join(input.outDir, "queue.json"), queue);

  // manifest.json LAST — its existence signals the run is committed-to-disk.
  const manifest = {
    schemaVersion: FINDING_SCHEMA_VERSION,
    runId: input.runId,
    status: "ok" as const,
    probes: input.probes,
    surfaces: input.surfaces,
    durationMs: input.durationMs,
    completedAt: new Date().toISOString(),
  };
  atomicWriteJson(join(input.outDir, "manifest.json"), manifest);
}
```

- [ ] **Step 4: Run JSON reporter tests**

Run: `cd packages/audit && bun test tests/reporters/json-queue.test.ts`
Expected: 3 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
cd /home/dev/rox/rox-one-terminal
git add packages/audit/src/reporters/json-queue.ts packages/audit/tests/reporters/json-queue.test.ts
git -c user.name="Mark Lindgreen" -c user.email="mark@agisota.com" commit -m "feat(audit): JSON queue reporter with atomic write + manifest-last [T060]"
```

---

## Task 8: Markdown sidecar reporter (TDD)

**Files:**
- Create: `packages/audit/src/reporters/markdown-sidecar.ts`
- Create: `packages/audit/tests/reporters/markdown-sidecar.test.ts`

- [ ] **Step 1: Write the failing test for severity-grouped Markdown**

Create `packages/audit/tests/reporters/markdown-sidecar.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeMarkdownSidecar } from "../../src/reporters/markdown-sidecar.ts";
import type { Finding } from "../../src/probe.ts";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "audit-md-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const baseFinding = (overrides: Partial<Finding>): Finding => ({
  schemaVersion: 1,
  id: "0000000000000000",
  probe: "p",
  surface: "renderer",
  phase: "A.1",
  severity: "low",
  rule: "R",
  location: { file: "f" },
  message: "m",
  confidence: 1,
  vdiImpact: { quality: 0, risk: 0, readiness: 0 },
  firstSeen: "2026-05-09T11:00:00Z",
  lastSeen: "2026-05-09T11:00:00Z",
  ...overrides,
});

describe("writeMarkdownSidecar", () => {
  test("groups by severity with critical first", async () => {
    await writeMarkdownSidecar({
      outDir: dir,
      runId: "r1",
      findings: [
        baseFinding({ id: "1111", severity: "low" }),
        baseFinding({ id: "2222", severity: "critical" }),
      ],
    });
    const md = readFileSync(join(dir, "queue.md"), "utf-8");
    const criticalIdx = md.indexOf("## Critical");
    const lowIdx = md.indexOf("## Low");
    expect(criticalIdx).toBeGreaterThanOrEqual(0);
    expect(lowIdx).toBeGreaterThan(criticalIdx);
  });

  test("includes finding count in header", async () => {
    await writeMarkdownSidecar({ outDir: dir, runId: "r1", findings: [baseFinding({ id: "1111" })] });
    const md = readFileSync(join(dir, "queue.md"), "utf-8");
    expect(md).toContain("1 finding");
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd packages/audit && bun test tests/reporters/markdown-sidecar.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/reporters/markdown-sidecar.ts`**

Create `packages/audit/src/reporters/markdown-sidecar.ts`:

```typescript
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Finding, FindingSeverity } from "../probe.ts";

const SEVERITY_ORDER: FindingSeverity[] = ["critical", "high", "medium", "low"];

export interface WriteMarkdownSidecarInput {
  outDir: string;
  runId: string;
  findings: Finding[];
}

function atomicWrite(path: string, content: string): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, content);
  renameSync(tmp, path);
}

function findingToBullet(f: Finding): string {
  const loc = f.location.line ? `${f.location.file}:${f.location.line}` : f.location.file;
  return `- **[${f.surface}]** \`${f.rule}\` — ${f.message} \`(${loc})\` _confidence ${f.confidence}_ \`id:${f.id}\``;
}

export async function writeMarkdownSidecar(input: WriteMarkdownSidecarInput): Promise<void> {
  mkdirSync(input.outDir, { recursive: true });
  const lines: string[] = [
    `# Audit Queue — ${input.runId}`,
    "",
    `Generated: ${new Date().toISOString()}`,
    `Total: ${input.findings.length} finding${input.findings.length === 1 ? "" : "s"}`,
    "",
  ];

  for (const sev of SEVERITY_ORDER) {
    const group = input.findings.filter((f) => f.severity === sev);
    if (group.length === 0) continue;
    lines.push(`## ${sev[0].toUpperCase() + sev.slice(1)} (${group.length})`, "");
    for (const f of group) lines.push(findingToBullet(f));
    lines.push("");
  }

  atomicWrite(join(input.outDir, "queue.md"), lines.join("\n"));
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/audit && bun test tests/reporters/markdown-sidecar.test.ts`
Expected: 2 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
cd /home/dev/rox/rox-one-terminal
git add packages/audit/src/reporters/markdown-sidecar.ts packages/audit/tests/reporters/markdown-sidecar.test.ts
git -c user.name="Mark Lindgreen" -c user.email="mark@agisota.com" commit -m "feat(audit): Markdown sidecar reporter, severity-grouped [T060]"
```

---

## Task 9: CLI entrypoint (TDD-lite — smoke test only, integration tests in Task 23)

**Files:**
- Create: `packages/audit/src/cli.ts`
- Create: `packages/audit/tests/cli.test.ts` (smoke only)

- [ ] **Step 1: Write a simple CLI smoke test**

Create `packages/audit/tests/cli.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const CLI = join(import.meta.dir, "..", "src", "cli.ts");

describe("cli", () => {
  test("`audit --help` prints usage and exits 0", () => {
    const result = spawnSync("bun", ["run", CLI, "--help"], { encoding: "utf-8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage:");
    expect(result.stdout).toContain("audit run");
  });

  test("`audit run` with no surfaces exits 1 with helpful error", () => {
    const result = spawnSync("bun", ["run", CLI, "run"], { encoding: "utf-8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("surfaces");
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `cd packages/audit && bun test tests/cli.test.ts`
Expected: FAIL — `cli.ts` doesn't exist.

- [ ] **Step 3: Implement `src/cli.ts`**

Create `packages/audit/src/cli.ts`:

```typescript
#!/usr/bin/env bun
import { ProbeRegistry } from "./registry.ts";
import { rank } from "./ranker.ts";
import { writeJsonQueue } from "./reporters/json-queue.ts";
import { writeMarkdownSidecar } from "./reporters/markdown-sidecar.ts";
import type { Probe, Surface } from "./probe.ts";
import { join } from "node:path";

const HELP = `Usage:
  audit run <surfaces> [--probes=<csv>] [--worker-cap=N] [--out=<path>]

  surfaces: comma-separated, one or more of: renderer, webui, viewer, marketing
  --probes: comma-separated probe names (supports * suffix glob)
  --worker-cap: parallel probe-surface pairs (default 4)
  --out: output dir override (default audits/<ISO timestamp>)

Examples:
  audit run renderer --probes=static-tsc
  audit run renderer,webui,viewer,marketing --probes=static-*
`;

function parseArgs(argv: string[]): {
  command: "run" | "help";
  surfaces: Surface[];
  probesGlob: string;
  workerCap: number;
  outOverride?: string;
} {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    return { command: "help", surfaces: [], probesGlob: "*", workerCap: 4 };
  }
  if (args[0] !== "run") {
    return { command: "help", surfaces: [], probesGlob: "*", workerCap: 4 };
  }
  const surfacesArg = args[1];
  if (!surfacesArg || surfacesArg.startsWith("--")) {
    throw new Error("`audit run` requires a surfaces argument (e.g. `audit run renderer,webui`)");
  }
  const validSurfaces: Surface[] = ["renderer", "webui", "viewer", "marketing"];
  const surfaces = surfacesArg.split(",").map((s) => s.trim()) as Surface[];
  for (const s of surfaces) {
    if (!validSurfaces.includes(s)) throw new Error(`Unknown surface: ${s}`);
  }
  let probesGlob = "*";
  let workerCap = 4;
  let outOverride: string | undefined;
  for (const arg of args.slice(2)) {
    if (arg.startsWith("--probes=")) probesGlob = arg.slice("--probes=".length);
    else if (arg.startsWith("--worker-cap=")) workerCap = Math.max(1, parseInt(arg.slice("--worker-cap=".length), 10) || 4);
    else if (arg.startsWith("--out=")) outOverride = arg.slice("--out=".length);
  }
  return { command: "run", surfaces, probesGlob, workerCap, outOverride };
}

function probeMatches(name: string, glob: string): boolean {
  // Supports CSV of patterns, each may end with *
  for (const pat of glob.split(",").map((s) => s.trim())) {
    if (pat === "*") return true;
    if (pat.endsWith("*")) {
      if (name.startsWith(pat.slice(0, -1))) return true;
    } else if (name === pat) return true;
  }
  return false;
}

async function main(): Promise<number> {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs(process.argv);
  } catch (e) {
    process.stderr.write(`error: ${e instanceof Error ? e.message : String(e)}\n${HELP}`);
    return 1;
  }
  if (parsed.command === "help") {
    process.stdout.write(HELP);
    return 0;
  }

  // Discover probes by static import. Each probe module exports a default Probe.
  const registry = new ProbeRegistry();
  const probeModules: Probe[] = [];
  // Static probes are appended here as they are implemented in later tasks.
  // (T061 will add static-tsc, T062 static-eslint, T063 static-bundle.)
  for (const p of probeModules) {
    if (probeMatches(p.name, parsed.probesGlob)) registry.register(p);
  }

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = parsed.outOverride ?? join(process.cwd(), "audits", runId);
  const workspaceRoot = process.cwd();
  const surfacePaths: Record<Surface, string> = {
    renderer: join(workspaceRoot, "apps/electron/src/renderer"),
    webui: join(workspaceRoot, "apps/webui"),
    viewer: join(workspaceRoot, "apps/viewer"),
    marketing: join(workspaceRoot, "apps/marketing"),
  };

  const start = Date.now();
  const result = await registry.run({
    surfaces: parsed.surfaces,
    probes: registry.list().map((p) => p.name),
    workerCap: parsed.workerCap,
    contextFor: (surface) => ({
      surface,
      workspaceRoot,
      surfaceRoot: surfacePaths[surface],
      timeoutMs: 60_000,
    }),
  });
  const ranked = rank(result.findings);
  const duration = Date.now() - start;

  await writeJsonQueue({ outDir, findings: ranked, runId, probes: result.runProbes, surfaces: parsed.surfaces, durationMs: duration });
  await writeMarkdownSidecar({ outDir, runId, findings: ranked });

  process.stdout.write(`audit run complete: ${ranked.length} findings, ${duration}ms\n  ${outDir}/queue.json\n  ${outDir}/queue.md\n`);
  return 0;
}

const code = await main();
process.exit(code);
```

- [ ] **Step 4: Run smoke tests**

Run: `cd packages/audit && bun test tests/cli.test.ts`
Expected: 2 pass.

- [ ] **Step 5: Commit**

```bash
cd /home/dev/rox/rox-one-terminal
git add packages/audit/src/cli.ts packages/audit/tests/cli.test.ts
git -c user.name="Mark Lindgreen" -c user.email="mark@agisota.com" commit -m "feat(audit): CLI entrypoint with --help, --probes, --worker-cap, --out [T060]"
```

---

## Task 10: T060 ticket + worklog files (AGENTS.md compliance)

**Files:**
- Create: `docs/tickets/T060-bootstrap-audit-package.md`
- Create: `docs/worklog/T060-bootstrap-audit-package.md`

- [ ] **Step 1: Write the T060 ticket file**

Create `docs/tickets/T060-bootstrap-audit-package.md`:

```markdown
# T060 — Bootstrap audit package

## Summary

Create the `packages/audit/` Bun workspace member with `Probe` interface, `ProbeRegistry`, `ranker`, JSON+Markdown reporters, and a `cli.ts` entrypoint. No probes ship in this ticket — T061-T063 add the three static probes; T064 adds ticket-gen and the first end-to-end run.

## Acceptance Criteria

- `packages/audit/package.json` exists, name `audit`, private, Bun workspace member.
- `packages/audit/src/probe.ts` exports `Probe`, `Finding`, `FindingSeverity`, `Surface`, `Phase`, `computeFindingId`, `FINDING_SCHEMA_VERSION = 1`.
- `ProbeRegistry` supports `register`, `list`, `run` with parallelism (worker cap), per-probe timeout, and crash isolation that emits zero-confidence findings (`_probe.timeout`, `_probe.crash`).
- `rank()` is a pure deterministic function; same input → same output across runs; ties broken by id ASCII order.
- `writeJsonQueue` writes `queue.json` then `manifest.json` last, atomic tmp+rename, no `.tmp` files left behind on success.
- `writeMarkdownSidecar` writes a severity-grouped `queue.md`.
- `audit --help` prints usage and exits 0; `audit run` with no surfaces exits 1 with helpful error.
- All tests pass with `bun test` from `packages/audit/`.
- Branch coverage ≥80% on `packages/audit/src/`.
- `audits/` is gitignored at repo root.

## TDD Test Shape

- `tests/probe.test.ts` — id stability, Finding shape.
- `tests/registry.test.ts` — register, run, parallelism, timeout, crash isolation.
- `tests/ranker.test.ts` — golden ordering, ties, determinism, stability under append.
- `tests/reporters/json-queue.test.ts` — atomic write, manifest-last, no orphan tmp files.
- `tests/reporters/markdown-sidecar.test.ts` — severity grouping, finding count.
- `tests/cli.test.ts` — `--help`, missing-surfaces error.

## Files Affected

Create:
- `packages/audit/package.json`
- `packages/audit/tsconfig.json`
- `packages/audit/README.md`
- `packages/audit/src/probe.ts`
- `packages/audit/src/registry.ts`
- `packages/audit/src/ranker.ts`
- `packages/audit/src/ranker.config.ts`
- `packages/audit/src/cli.ts`
- `packages/audit/src/reporters/json-queue.ts`
- `packages/audit/src/reporters/markdown-sidecar.ts`
- `packages/audit/tests/*` (mirrors `src/`)

Modify:
- `.gitignore` (add `audits/`)
```

- [ ] **Step 2: Write the T060 worklog file**

Create `docs/worklog/T060-bootstrap-audit-package.md`:

```markdown
# T060 — Bootstrap audit package — worklog

## 1. Task summary
Bootstrap `packages/audit/` workspace with Probe interface, ProbeRegistry, ranker, reporters, CLI. Per-commit conventional commits, no production deps beyond `js-yaml` (already in repo).

## 2. Repo context discovered
- Bun workspaces use flat `node_modules/<pkg>` symlinks; `audit` matches existing pattern (`shared`, `core`, `ui`, etc.).
- Existing scripts in root `package.json` use `bun run <script>`; new `audit` script follows that pattern.
- `tsconfig.base.json` is the shared root; per-package tsconfigs extend it.
- AGENTS.md mandates this exact 11-section worklog.

## 3. Files inspected
- `package.json` (root) — workspace globs.
- `tsconfig.base.json` — strict mode flags.
- `packages/shared/package.json` — pattern for workspace member.

## 4. Tests added first
- `tests/probe.test.ts` — 4 cases.
- `tests/registry.test.ts` — 7 cases (3 basic + 2 parallelism + 2 error-handling).
- `tests/ranker.test.ts` — 6 cases.
- `tests/reporters/json-queue.test.ts` — 3 cases.
- `tests/reporters/markdown-sidecar.test.ts` — 2 cases.
- `tests/cli.test.ts` — 2 cases.

## 5. Expected failing test output
All tests fail with "Cannot find module" or equivalent before implementation lands.

## 6. Implementation changes
See ticket file. Files created listed there. Highlights: schemaVersion=1 frozen for A.1–A.4; ranker weights live in `ranker.config.ts` so changes are reviewable.

## 7. Validation commands run
- `cd packages/audit && bun test`
- `cd packages/audit && bun run typecheck`
- `bun run audit --help`
- `bun run audit run` (expect exit 1, useful error)
- `bun run typecheck:all` (full repo typecheck still green)

## 8. Passing test output summary
24 tests pass across the 6 test files.

## 9. Build output summary
N/A — no build step in T060 (probes are run as TypeScript directly via Bun).

## 10. Remaining risks
- Worker pool implementation uses `Array.shift()` which is O(n); fine for ≤100 probes but document.
- Timeout helper races a `setTimeout` against the probe — long-running probes leak the inner timer until completion; acceptable at A.1 scale.
- `cli.ts` has no probes wired in yet — T061-T063 register them.

## 11. Acceptance criteria matrix

| Criterion | Status |
|---|---|
| Package created and discovered by `bun pm ls --workspaces` | [pending verification] |
| Probe interface complete | [pending] |
| Registry parallel + timeout + crash | [pending] |
| Ranker deterministic | [pending] |
| Reporters atomic + manifest-last | [pending] |
| CLI `--help` and missing-surfaces handling | [pending] |
| All tests pass | [pending] |
| `audits/` gitignored | [pending] |
```

- [ ] **Step 3: Commit ticket and worklog**

```bash
cd /home/dev/rox/rox-one-terminal
git add docs/tickets/T060-bootstrap-audit-package.md docs/worklog/T060-bootstrap-audit-package.md
git -c user.name="Mark Lindgreen" -c user.email="mark@agisota.com" commit -m "docs(audit): T060 ticket + worklog scaffolding"
```

---

## Task 11: static-tsc — fixture project (hermetic broken TS)

**Files:**
- Create: `packages/audit/tests/fixtures/tsc-broken/package.json`
- Create: `packages/audit/tests/fixtures/tsc-broken/tsconfig.json`
- Create: `packages/audit/tests/fixtures/tsc-broken/src/error1.ts`
- Create: `packages/audit/tests/fixtures/tsc-broken/src/error2.ts`
- Create: `packages/audit/tests/fixtures/tsc-broken/src/error3.ts`

- [ ] **Step 1: Create fixture package.json (NOT a Bun workspace member — the parent's `tsconfig.json` excludes `tests/fixtures/**`)**

Create `packages/audit/tests/fixtures/tsc-broken/package.json`:

```json
{
  "name": "tsc-broken-fixture",
  "version": "0.0.0",
  "private": true
}
```

- [ ] **Step 2: Create fixture tsconfig (strict, intentionally finds errors in `src/`)**

Create `packages/audit/tests/fixtures/tsc-broken/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noImplicitAny": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create three deliberately-broken TS files**

Create `packages/audit/tests/fixtures/tsc-broken/src/error1.ts`:

```typescript
// TS2345: argument-type mismatch
function takesNumber(n: number): number { return n; }
takesNumber("not a number");
```

Create `packages/audit/tests/fixtures/tsc-broken/src/error2.ts`:

```typescript
// TS2322: type-not-assignable
const value: number = "string";
export { value };
```

Create `packages/audit/tests/fixtures/tsc-broken/src/error3.ts`:

```typescript
// TS7006: implicit any
function withImplicitAny(x) { return x; }
export { withImplicitAny };
```

- [ ] **Step 4: Verify fixture is excluded from main tsconfig**

Run: `cd packages/audit && bun run typecheck`
Expected: 0 errors (fixtures excluded by `packages/audit/tsconfig.json`'s `exclude: ["tests/fixtures/**"]`).

- [ ] **Step 5: Verify the fixture itself produces 3 errors when typechecked**

Run: `cd packages/audit/tests/fixtures/tsc-broken && bunx tsc --noEmit -p tsconfig.json 2>&1 | grep -c 'error TS'`
Expected: 3 (one for each fixture file).

- [ ] **Step 6: Commit fixture**

```bash
cd /home/dev/rox/rox-one-terminal
git add packages/audit/tests/fixtures/tsc-broken/
git -c user.name="Mark Lindgreen" -c user.email="mark@agisota.com" commit -m "test(audit): tsc-broken fixture with TS2345/TS2322/TS7006 [T061]"
```

---

## Task 12: static-tsc probe — test + impl (TDD)

**Files:**
- Create: `packages/audit/src/probes/static-tsc.ts`
- Create: `packages/audit/tests/probes/static-tsc.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/audit/tests/probes/static-tsc.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { staticTscProbe } from "../../src/probes/static-tsc.ts";
import type { ProbeContext } from "../../src/probe.ts";

const FIXTURE_DIR = join(import.meta.dir, "..", "fixtures", "tsc-broken");

describe("static-tsc probe", () => {
  test("name and phase", () => {
    expect(staticTscProbe.name).toBe("static-tsc");
    expect(staticTscProbe.phase).toBe("A.1");
  });

  test("applicableTo returns true for all surfaces", () => {
    expect(staticTscProbe.applicableTo("renderer")).toBe(true);
    expect(staticTscProbe.applicableTo("webui")).toBe(true);
    expect(staticTscProbe.applicableTo("viewer")).toBe(true);
    expect(staticTscProbe.applicableTo("marketing")).toBe(true);
  });

  test("detects all 3 errors in tsc-broken fixture", async () => {
    const ctx: ProbeContext = {
      surface: "renderer",
      workspaceRoot: FIXTURE_DIR,
      surfaceRoot: FIXTURE_DIR,
      timeoutMs: 30_000,
    };
    const findings = await staticTscProbe.run(ctx);
    expect(findings.length).toBeGreaterThanOrEqual(3);
    const codes = findings.map((f) => f.rule);
    expect(codes.some((c) => c.includes("TS2345"))).toBe(true);
    expect(codes.some((c) => c.includes("TS2322"))).toBe(true);
    expect(codes.some((c) => c.includes("TS7006"))).toBe(true);
  });

  test("each finding has stable id, location.file, line", async () => {
    const ctx: ProbeContext = {
      surface: "renderer",
      workspaceRoot: FIXTURE_DIR,
      surfaceRoot: FIXTURE_DIR,
      timeoutMs: 30_000,
    };
    const findings = await staticTscProbe.run(ctx);
    for (const f of findings) {
      expect(f.id).toMatch(/^[0-9a-f]{16}$/);
      expect(f.location.file).toBeTruthy();
      expect(f.location.line).toBeGreaterThan(0);
      expect(f.confidence).toBe(1);
    }
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd packages/audit && bun test tests/probes/static-tsc.test.ts`
Expected: FAIL — `staticTscProbe` not exported.

- [ ] **Step 3: Implement `static-tsc.ts`**

Create `packages/audit/src/probes/static-tsc.ts`:

```typescript
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Finding, FindingSeverity, Probe, ProbeContext } from "../probe.ts";
import { computeFindingId, FINDING_SCHEMA_VERSION } from "../probe.ts";

// Map a tsc TS-code prefix range to severity. Conservative defaults.
function severityFor(code: string): FindingSeverity {
  // TS2xxx (assignability/argument-type) — high (likely real bugs)
  // TS7006 (implicit any) — medium (style + correctness signal)
  // TS6133 (unused) — low
  if (code === "TS6133" || code === "TS6196") return "low";
  if (code === "TS7006") return "medium";
  return "high";
}

interface TscDiagnostic {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
}

function parseTscOutput(output: string, surfaceRoot: string): TscDiagnostic[] {
  // tsc default format: `path/to/file.ts(line,col): error TSxxxx: message`
  const re = /^(.+?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)$/;
  const diags: TscDiagnostic[] = [];
  for (const raw of output.split("\n")) {
    const m = raw.match(re);
    if (!m) continue;
    const [, file, line, column, code, message] = m;
    diags.push({
      file: file.startsWith(surfaceRoot) ? file : join(surfaceRoot, file),
      line: parseInt(line, 10),
      column: parseInt(column, 10),
      code,
      message: message.trim(),
    });
  }
  return diags;
}

export const staticTscProbe: Probe = {
  name: "static-tsc",
  phase: "A.1",
  applicableTo: () => true,
  async run(ctx: ProbeContext): Promise<Finding[]> {
    const tsconfigPath = join(ctx.surfaceRoot, "tsconfig.json");
    if (!existsSync(tsconfigPath)) return [];
    const result = spawnSync("bunx", ["tsc", "--noEmit", "-p", tsconfigPath], {
      cwd: ctx.surfaceRoot,
      encoding: "utf-8",
      timeout: ctx.timeoutMs,
    });
    const output = (result.stdout ?? "") + (result.stderr ?? "");
    const diags = parseTscOutput(output, ctx.surfaceRoot);
    const now = new Date().toISOString();
    return diags.map((d) => {
      const sev = severityFor(d.code);
      const id = computeFindingId({ probe: "static-tsc", rule: `tsc:${d.code}`, file: d.file, line: d.line });
      const finding: Finding = {
        schemaVersion: FINDING_SCHEMA_VERSION,
        id,
        probe: "static-tsc",
        surface: ctx.surface,
        phase: "A.1",
        severity: sev,
        rule: `tsc:${d.code}`,
        location: { file: d.file, line: d.line, column: d.column },
        message: d.message,
        confidence: 1,
        vdiImpact: { quality: 0.6, risk: 0.4, readiness: 0.3 },
        firstSeen: now,
        lastSeen: now,
      };
      return finding;
    });
  },
};
```

- [ ] **Step 4: Run probe tests**

Run: `cd packages/audit && bun test tests/probes/static-tsc.test.ts`
Expected: 4 pass.

- [ ] **Step 5: Wire the probe into the CLI registry**

Modify `packages/audit/src/cli.ts`. Update the `probeModules` array near line 65 (just before the `for (const p of probeModules)` loop):

```typescript
import { staticTscProbe } from "./probes/static-tsc.ts";
// ... near probe registration:
const probeModules: Probe[] = [staticTscProbe];
```

- [ ] **Step 6: Run all package tests still green**

Run: `cd packages/audit && bun test`
Expected: 28 tests pass (24 from prior tasks + 4 new).

- [ ] **Step 7: Commit**

```bash
cd /home/dev/rox/rox-one-terminal
git add packages/audit/src/probes/static-tsc.ts packages/audit/tests/probes/static-tsc.test.ts packages/audit/src/cli.ts
git -c user.name="Mark Lindgreen" -c user.email="mark@agisota.com" commit -m "feat(audit): static-tsc probe wraps tsc --noEmit, parses diagnostics [T061]"
```

---

## Task 13: T061 ticket + worklog

**Files:**
- Create: `docs/tickets/T061-static-tsc-probe.md`
- Create: `docs/worklog/T061-static-tsc-probe.md`

- [ ] **Step 1: Write T061 ticket**

Create `docs/tickets/T061-static-tsc-probe.md`:

```markdown
# T061 — static-tsc probe

## Summary

Implement the `static-tsc` probe: wraps `tsc --noEmit -p <surfaceRoot>/tsconfig.json` per surface, parses `path(line,col): error TSxxxx: message` lines into structured `Finding` objects. Severity mapping: TS6133/6196 → low; TS7006 → medium; everything else → high.

## Acceptance Criteria

- `staticTscProbe.name === "static-tsc"`, `phase === "A.1"`.
- `applicableTo()` returns true for all four surfaces.
- Run against fixture `tests/fixtures/tsc-broken/` returns ≥3 findings covering TS2345, TS2322, TS7006.
- Each finding has stable hex id, populated `location.file` and `location.line`, and `confidence: 1`.
- Probe is registered in `cli.ts` so `audit run renderer --probes=static-tsc` works.
- All package tests still pass.

## TDD Test Shape

`tests/probes/static-tsc.test.ts`:
- Probe metadata (name, phase, applicability).
- Detects all 3 fixture errors.
- Finding shape integrity (id format, location populated, confidence).

## Files Affected

Create:
- `packages/audit/src/probes/static-tsc.ts`
- `packages/audit/tests/probes/static-tsc.test.ts`

Modify:
- `packages/audit/src/cli.ts` (register probe)
```

- [ ] **Step 2: Write T061 worklog**

Create `docs/worklog/T061-static-tsc-probe.md` with the 11 AGENTS.md sections, mirroring T060's format. Specifically: the worklog should record: tsc output format, regex used, severity mapping rationale, fixture verification steps.

```markdown
# T061 — static-tsc probe — worklog

## 1. Task summary
Wrap `tsc --noEmit` per surface, parse diagnostics → Finding[].

## 2. Repo context discovered
- Each `apps/<surface>/tsconfig.json` is the per-surface tsconfig (already exists across renderer/webui/viewer/marketing). The probe runs `tsc -p <surfaceRoot>/tsconfig.json`.
- Default tsc output uses `path(line,col): error TSxxxx: message`. Stable across TS 5.x.

## 3. Files inspected
- `apps/electron/tsconfig.json`
- `apps/webui/tsconfig.json`
- `apps/viewer/tsconfig.json`
- `apps/marketing/tsconfig.json` (verify exists)
- `tests/fixtures/tsc-broken/tsconfig.json` (created in T061 prereqs)

## 4. Tests added first
- `tests/probes/static-tsc.test.ts` — 4 cases.

## 5. Expected failing test output
"Cannot find module" until `static-tsc.ts` is created.

## 6. Implementation changes
- `src/probes/static-tsc.ts` — exec tsc via `bunx`, parse output with regex, emit Finding[].
- `src/cli.ts` — register probe.

## 7. Validation commands run
- `cd packages/audit && bun test tests/probes/static-tsc.test.ts`
- `cd packages/audit && bun test` (full)
- `bun run audit run renderer --probes=static-tsc --out=/tmp/audit-test`

## 8. Passing test output summary
4 pass.

## 9. Build output summary
N/A.

## 10. Remaining risks
- `bunx tsc` resolves to whichever TypeScript is in node_modules — pinned via root `package.json` typescript dep.
- Some tsc errors span multiple lines (related-info diagnostics); current regex only captures the primary line. Acceptable for A.1.
- If a surface lacks `tsconfig.json`, probe returns []. Document in README.

## 11. Acceptance criteria matrix

| Criterion | Status |
|---|---|
| Probe metadata correct | [pending] |
| Applicable to all surfaces | [pending] |
| Detects 3 fixture errors | [pending] |
| Finding shape integrity | [pending] |
| Wired into CLI | [pending] |
| Package tests green | [pending] |
```

- [ ] **Step 3: Commit ticket + worklog**

```bash
cd /home/dev/rox/rox-one-terminal
git add docs/tickets/T061-static-tsc-probe.md docs/worklog/T061-static-tsc-probe.md
git -c user.name="Mark Lindgreen" -c user.email="mark@agisota.com" commit -m "docs(audit): T061 ticket + worklog"
```

---

## Task 14: static-eslint — fixture

**Files:**
- Create: `packages/audit/tests/fixtures/eslint-broken/package.json`
- Create: `packages/audit/tests/fixtures/eslint-broken/.eslintrc.json`
- Create: `packages/audit/tests/fixtures/eslint-broken/src/no-unused.ts`
- Create: `packages/audit/tests/fixtures/eslint-broken/src/no-console.ts`

- [ ] **Step 1: Create fixture manifest**

Create `packages/audit/tests/fixtures/eslint-broken/package.json`:

```json
{
  "name": "eslint-broken-fixture",
  "version": "0.0.0",
  "private": true
}
```

- [ ] **Step 2: Create minimal eslint config**

Create `packages/audit/tests/fixtures/eslint-broken/.eslintrc.json`:

```json
{
  "root": true,
  "rules": {
    "no-unused-vars": "error",
    "no-console": "error"
  },
  "parserOptions": { "ecmaVersion": 2022, "sourceType": "module" }
}
```

- [ ] **Step 3: Create violators**

Create `packages/audit/tests/fixtures/eslint-broken/src/no-unused.ts`:

```typescript
const unused = 42;
export const used = 1;
```

Create `packages/audit/tests/fixtures/eslint-broken/src/no-console.ts`:

```typescript
export function hello(): void {
  console.log("hi");
}
```

- [ ] **Step 4: Verify fixture produces violations**

Run: `cd packages/audit/tests/fixtures/eslint-broken && bunx eslint --no-eslintrc --config .eslintrc.json --format=json src/ | jq '[.[].messages[]] | length'`
Expected: ≥2.

- [ ] **Step 5: Commit fixture**

```bash
cd /home/dev/rox/rox-one-terminal
git add packages/audit/tests/fixtures/eslint-broken/
git -c user.name="Mark Lindgreen" -c user.email="mark@agisota.com" commit -m "test(audit): eslint-broken fixture (no-unused-vars, no-console) [T062]"
```

---

## Task 15: static-eslint probe — test + impl (TDD)

**Files:**
- Create: `packages/audit/src/probes/static-eslint.ts`
- Create: `packages/audit/tests/probes/static-eslint.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/audit/tests/probes/static-eslint.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { staticEslintProbe } from "../../src/probes/static-eslint.ts";
import type { ProbeContext } from "../../src/probe.ts";

const FIXTURE_DIR = join(import.meta.dir, "..", "fixtures", "eslint-broken");

describe("static-eslint probe", () => {
  test("metadata", () => {
    expect(staticEslintProbe.name).toBe("static-eslint");
    expect(staticEslintProbe.phase).toBe("A.1");
    expect(staticEslintProbe.applicableTo("renderer")).toBe(true);
  });

  test("detects fixture violations", async () => {
    const ctx: ProbeContext = {
      surface: "renderer",
      workspaceRoot: FIXTURE_DIR,
      surfaceRoot: FIXTURE_DIR,
      timeoutMs: 30_000,
    };
    const findings = await staticEslintProbe.run(ctx);
    expect(findings.length).toBeGreaterThanOrEqual(2);
    const rules = findings.map((f) => f.rule);
    expect(rules.some((r) => r.includes("no-unused-vars"))).toBe(true);
    expect(rules.some((r) => r.includes("no-console"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `cd packages/audit && bun test tests/probes/static-eslint.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `static-eslint.ts`**

Create `packages/audit/src/probes/static-eslint.ts`:

```typescript
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Finding, FindingSeverity, Probe, ProbeContext } from "../probe.ts";
import { computeFindingId, FINDING_SCHEMA_VERSION } from "../probe.ts";

// eslint --format=json schema (simplified to fields we use)
interface EslintFileReport {
  filePath: string;
  messages: Array<{
    ruleId: string | null;
    severity: 1 | 2; // 1 = warning, 2 = error
    message: string;
    line: number;
    column: number;
  }>;
}

function severityFor(eslintSev: 1 | 2): FindingSeverity {
  return eslintSev === 2 ? "high" : "medium";
}

export const staticEslintProbe: Probe = {
  name: "static-eslint",
  phase: "A.1",
  applicableTo: () => true,
  async run(ctx: ProbeContext): Promise<Finding[]> {
    // Find an eslint config in the surface root (.eslintrc, .eslintrc.json, eslint.config.js)
    const candidateConfigs = [".eslintrc.json", ".eslintrc.js", ".eslintrc", "eslint.config.js"];
    const configPath = candidateConfigs.find((c) => existsSync(join(ctx.surfaceRoot, c)));
    if (!configPath) return [];

    const args = ["eslint", "--format=json", "--no-error-on-unmatched-pattern"];
    if (configPath.startsWith(".eslintrc")) {
      args.push("--no-eslintrc", "--config", configPath);
    }
    args.push("src/");
    const result = spawnSync("bunx", args, {
      cwd: ctx.surfaceRoot,
      encoding: "utf-8",
      timeout: ctx.timeoutMs,
      maxBuffer: 50 * 1024 * 1024,
    });
    const stdout = result.stdout ?? "";
    if (!stdout.trim()) return [];

    let reports: EslintFileReport[];
    try {
      reports = JSON.parse(stdout);
    } catch {
      return []; // malformed output; let registry treat as empty
    }

    const now = new Date().toISOString();
    const findings: Finding[] = [];
    for (const report of reports) {
      for (const m of report.messages) {
        const ruleId = m.ruleId ?? "unknown";
        const id = computeFindingId({ probe: "static-eslint", rule: `eslint:${ruleId}`, file: report.filePath, line: m.line });
        findings.push({
          schemaVersion: FINDING_SCHEMA_VERSION,
          id,
          probe: "static-eslint",
          surface: ctx.surface,
          phase: "A.1",
          severity: severityFor(m.severity),
          rule: `eslint:${ruleId}`,
          location: { file: report.filePath, line: m.line, column: m.column },
          message: m.message,
          confidence: 1,
          vdiImpact: { quality: 0.5, risk: 0.3, readiness: 0.2 },
          firstSeen: now,
          lastSeen: now,
        });
      }
    }
    return findings;
  },
};
```

- [ ] **Step 4: Wire into CLI**

Modify `packages/audit/src/cli.ts`:

```typescript
import { staticEslintProbe } from "./probes/static-eslint.ts";
// ...
const probeModules: Probe[] = [staticTscProbe, staticEslintProbe];
```

- [ ] **Step 5: Run tests**

Run: `cd packages/audit && bun test`
Expected: 30 pass.

- [ ] **Step 6: Commit**

```bash
cd /home/dev/rox/rox-one-terminal
git add packages/audit/src/probes/static-eslint.ts packages/audit/tests/probes/static-eslint.test.ts packages/audit/src/cli.ts
git -c user.name="Mark Lindgreen" -c user.email="mark@agisota.com" commit -m "feat(audit): static-eslint probe parses eslint --format=json [T062]"
```

---

## Task 16: T062 ticket + worklog

Same shape as T061. Create `docs/tickets/T062-static-eslint-probe.md` and `docs/worklog/T062-static-eslint-probe.md` with content matching the actual implementation. Required sections per AGENTS.md (11 worklog sections, ticket has summary/acceptance/TDD/files).

- [ ] **Step 1: Write ticket file**

Create `docs/tickets/T062-static-eslint-probe.md`:

```markdown
# T062 — static-eslint probe

## Summary
Implement `static-eslint` probe: runs `eslint --format=json` per surface root, parses JSON output into `Finding[]`. Severity mapping: error → high, warning → medium.

## Acceptance Criteria
- Probe metadata: name `static-eslint`, phase `A.1`, applicableTo all surfaces.
- Detects ≥2 violations in `tests/fixtures/eslint-broken/` (no-unused-vars + no-console).
- Each finding has stable id, location.file, location.line, confidence: 1.
- Wired into CLI registry; `audit run renderer --probes=static-eslint` works.
- All package tests still pass.

## TDD Test Shape
`tests/probes/static-eslint.test.ts`: metadata, fixture detection.

## Files Affected
Create: `src/probes/static-eslint.ts`, `tests/probes/static-eslint.test.ts`.
Modify: `src/cli.ts`.
```

- [ ] **Step 2: Write worklog (mirror T061 worklog structure with eslint specifics)**

Create `docs/worklog/T062-static-eslint-probe.md` following the 11-section AGENTS.md format. Replace tsc-specific content with eslint specifics: discovery of eslint configs across surfaces, JSON output schema, severity mapping rationale, fixture verification, validation commands run, etc.

- [ ] **Step 3: Commit**

```bash
cd /home/dev/rox/rox-one-terminal
git add docs/tickets/T062-static-eslint-probe.md docs/worklog/T062-static-eslint-probe.md
git -c user.name="Mark Lindgreen" -c user.email="mark@agisota.com" commit -m "docs(audit): T062 ticket + worklog"
```

---

## Task 17: static-bundle — fixture

**Files:**
- Create: `packages/audit/tests/fixtures/bundle-bloated/package.json`
- Create: `packages/audit/tests/fixtures/bundle-bloated/dist/main.js`
- Create: `packages/audit/tests/fixtures/bundle-bloated/budget.json`

- [ ] **Step 1: Create fixture manifest**

Create `packages/audit/tests/fixtures/bundle-bloated/package.json`:

```json
{
  "name": "bundle-bloated-fixture",
  "version": "0.0.0",
  "private": true
}
```

- [ ] **Step 2: Create budget config**

Create `packages/audit/tests/fixtures/bundle-bloated/budget.json`:

```json
{
  "main.js": 200000
}
```

- [ ] **Step 3: Create a fake bloated dist**

Create `packages/audit/tests/fixtures/bundle-bloated/dist/main.js`:

```javascript
// Synthetic bundle. ~250KB of bytes to exceed 200KB budget. The fixture builder
// pads this file at test time. For checked-in version we use a smaller pad and
// the test runner inflates it (see Step 4).
"_".repeat(250000);
```

- [ ] **Step 4: Add a fixture-builder script invoked by tests (avoids checking in 250KB)**

Create `packages/audit/tests/fixtures/bundle-bloated/build-fixture.ts`:

```typescript
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const target = join(import.meta.dir, "dist", "main.js");
const content = `// padded\n${"a".repeat(250000)}`;
writeFileSync(target, content);
console.log(`built ${target} (${content.length} bytes)`);
```

Run: `cd packages/audit/tests/fixtures/bundle-bloated && bun run build-fixture.ts`
Expected: Prints "built ... (250012 bytes)".

- [ ] **Step 5: Verify dist/main.js > 200000 bytes**

Run: `wc -c packages/audit/tests/fixtures/bundle-bloated/dist/main.js`
Expected: ≥250000.

- [ ] **Step 6: Add `dist/main.js` to .gitignore for the fixture (built at test time)**

Create `packages/audit/tests/fixtures/bundle-bloated/.gitignore`:

```
dist/main.js
```

- [ ] **Step 7: Commit fixture (everything except the built dist)**

```bash
cd /home/dev/rox/rox-one-terminal
git add packages/audit/tests/fixtures/bundle-bloated/package.json \
       packages/audit/tests/fixtures/bundle-bloated/budget.json \
       packages/audit/tests/fixtures/bundle-bloated/build-fixture.ts \
       packages/audit/tests/fixtures/bundle-bloated/.gitignore
git -c user.name="Mark Lindgreen" -c user.email="mark@agisota.com" commit -m "test(audit): bundle-bloated fixture with budget.json [T063]"
```

---

## Task 18: static-bundle probe — test + impl (TDD)

**Files:**
- Create: `packages/audit/src/probes/static-bundle.ts`
- Create: `packages/audit/tests/probes/static-bundle.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/audit/tests/probes/static-bundle.test.ts`:

```typescript
import { beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { staticBundleProbe } from "../../src/probes/static-bundle.ts";
import type { ProbeContext } from "../../src/probe.ts";

const FIXTURE_DIR = join(import.meta.dir, "..", "fixtures", "bundle-bloated");

beforeAll(() => {
  // Build the fixture dist/main.js
  spawnSync("bun", ["run", "build-fixture.ts"], { cwd: FIXTURE_DIR, encoding: "utf-8" });
});

describe("static-bundle probe", () => {
  test("metadata", () => {
    expect(staticBundleProbe.name).toBe("static-bundle");
    expect(staticBundleProbe.phase).toBe("A.1");
    expect(staticBundleProbe.applicableTo("renderer")).toBe(true);
  });

  test("emits finding when bundle exceeds budget", async () => {
    const ctx: ProbeContext = {
      surface: "renderer",
      workspaceRoot: FIXTURE_DIR,
      surfaceRoot: FIXTURE_DIR,
      buildOutputRoot: join(FIXTURE_DIR, "dist"),
      timeoutMs: 30_000,
    };
    const findings = await staticBundleProbe.run(ctx);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].rule).toBe("bundle:over-budget");
    expect(findings[0].severity).toBe("high");
  });

  test("returns no findings when bundle under budget", async () => {
    // Quick mod: shrink the file
    const small = join(FIXTURE_DIR, "dist", "small.js");
    Bun.write(small, "x"); // 1 byte
    const ctx: ProbeContext = {
      surface: "renderer",
      workspaceRoot: FIXTURE_DIR,
      surfaceRoot: FIXTURE_DIR,
      buildOutputRoot: join(FIXTURE_DIR, "dist"),
      timeoutMs: 30_000,
    };
    const findings = await staticBundleProbe.run(ctx);
    // main.js is still over budget → 1 finding still expected
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `cd packages/audit && bun test tests/probes/static-bundle.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `static-bundle.ts`**

Create `packages/audit/src/probes/static-bundle.ts`:

```typescript
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Finding, Probe, ProbeContext } from "../probe.ts";
import { computeFindingId, FINDING_SCHEMA_VERSION } from "../probe.ts";

interface BudgetMap { [filename: string]: number }

function readBudget(surfaceRoot: string): BudgetMap | null {
  const path = join(surfaceRoot, "budget.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as BudgetMap;
  } catch {
    return null;
  }
}

export const staticBundleProbe: Probe = {
  name: "static-bundle",
  phase: "A.1",
  applicableTo: () => true,
  async run(ctx: ProbeContext): Promise<Finding[]> {
    const budget = readBudget(ctx.surfaceRoot);
    if (!budget) return [];
    const distRoot = ctx.buildOutputRoot ?? join(ctx.surfaceRoot, "dist");
    if (!existsSync(distRoot)) return [];
    const now = new Date().toISOString();
    const findings: Finding[] = [];
    for (const [filename, max] of Object.entries(budget)) {
      const filePath = join(distRoot, filename);
      if (!existsSync(filePath)) continue;
      const size = statSync(filePath).size;
      if (size <= max) continue;
      const id = computeFindingId({ probe: "static-bundle", rule: "bundle:over-budget", file: filePath, line: 0 });
      findings.push({
        schemaVersion: FINDING_SCHEMA_VERSION,
        id,
        probe: "static-bundle",
        surface: ctx.surface,
        phase: "A.1",
        severity: "high",
        rule: "bundle:over-budget",
        location: { file: filePath },
        message: `${filename} is ${size} bytes (budget: ${max} bytes, over by ${size - max})`,
        confidence: 1,
        vdiImpact: { quality: 0.5, risk: 0.3, readiness: 0.7 },
        firstSeen: now,
        lastSeen: now,
      });
    }
    return findings;
  },
};
```

- [ ] **Step 4: Wire into CLI**

Modify `packages/audit/src/cli.ts`:

```typescript
import { staticBundleProbe } from "./probes/static-bundle.ts";
// ...
const probeModules: Probe[] = [staticTscProbe, staticEslintProbe, staticBundleProbe];
```

- [ ] **Step 5: Run all tests**

Run: `cd packages/audit && bun test`
Expected: 33 pass.

- [ ] **Step 6: Commit**

```bash
cd /home/dev/rox/rox-one-terminal
git add packages/audit/src/probes/static-bundle.ts packages/audit/tests/probes/static-bundle.test.ts packages/audit/src/cli.ts
git -c user.name="Mark Lindgreen" -c user.email="mark@agisota.com" commit -m "feat(audit): static-bundle probe checks dist/ against budget.json [T063]"
```

---

## Task 19: T063 ticket + worklog

- [ ] **Step 1: Write ticket** — `docs/tickets/T063-static-bundle-probe.md` matching T061/T062 shape; specify: probe metadata, budget.json schema, fixture detection, ≥1 over-budget finding for the fixture.

- [ ] **Step 2: Write worklog** — `docs/worklog/T063-static-bundle-probe.md` with 11 AGENTS.md sections covering: budget.json discovery rationale, why the fixture is built at test time vs checked in, behavior when budget.json or dist/ is missing.

- [ ] **Step 3: Commit**

```bash
cd /home/dev/rox/rox-one-terminal
git add docs/tickets/T063-static-bundle-probe.md docs/worklog/T063-static-bundle-probe.md
git -c user.name="Mark Lindgreen" -c user.email="mark@agisota.com" commit -m "docs(audit): T063 ticket + worklog"
```

---

## Task 20: ticket-gen — basic generation (TDD)

**Files:**
- Create: `packages/audit/src/ticket-gen.ts`
- Create: `packages/audit/tests/ticket-gen.test.ts`

- [ ] **Step 1: Write failing tests for basic generation**

Create `packages/audit/tests/ticket-gen.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateTickets } from "../src/ticket-gen.ts";
import type { Finding } from "../src/probe.ts";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "audit-tg-"));
  mkdirSync(join(dir, "docs", "tickets"), { recursive: true });
});
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const baseFinding = (overrides: Partial<Finding>): Finding => ({
  schemaVersion: 1,
  id: "1111111111111111",
  probe: "static-tsc",
  surface: "renderer",
  phase: "A.1",
  severity: "high",
  rule: "tsc:TS2345",
  location: { file: "x.ts", line: 10 },
  message: "type mismatch",
  confidence: 1,
  vdiImpact: { quality: 0.6, risk: 0.4, readiness: 0.3 },
  firstSeen: "2026-05-09T11:00:00Z",
  lastSeen: "2026-05-09T11:00:00Z",
  ...overrides,
});

describe("generateTickets — basic", () => {
  test("creates one ticket file per finding (top-K cap not hit)", async () => {
    await generateTickets({
      repoRoot: dir,
      findings: [baseFinding({ id: "aaaa", rule: "tsc:TS2345" }), baseFinding({ id: "bbbb", rule: "tsc:TS2322" })],
      topK: 50,
    });
    const created = readdirSync(join(dir, "docs/tickets"));
    expect(created.length).toBe(2);
  });

  test("ticket file contains frontmatter with findingId, firstSeen, lastSeen, status", async () => {
    await generateTickets({
      repoRoot: dir,
      findings: [baseFinding({ id: "abcd1234abcd1234" })],
      topK: 50,
    });
    const files = readdirSync(join(dir, "docs/tickets"));
    expect(files.length).toBe(1);
    const content = readFileSync(join(dir, "docs/tickets", files[0]), "utf-8");
    expect(content).toContain("findingId: abcd1234abcd1234");
    expect(content).toContain("status: open");
    expect(content).toMatch(/firstSeen:\s+'?2026-05-09T11:00:00Z'?/);
  });

  test("respects topK cap, excluding overflow", async () => {
    const findings = Array.from({ length: 5 }, (_, i) =>
      baseFinding({ id: `id${i}id${i}id${i}id${i}`.slice(0, 16), rule: `r${i}` }),
    );
    await generateTickets({ repoRoot: dir, findings, topK: 3 });
    const files = readdirSync(join(dir, "docs/tickets"));
    expect(files.length).toBe(3);
  });

  test("next ticket number increments from existing T<N>", async () => {
    writeFileSync(join(dir, "docs/tickets", "T059-prior.md"), "# prior");
    writeFileSync(join(dir, "docs/tickets", "T060-also-prior.md"), "# prior");
    await generateTickets({
      repoRoot: dir,
      findings: [baseFinding({ id: "aaaa", rule: "tsc:TS2345" })],
      topK: 50,
    });
    const files = readdirSync(join(dir, "docs/tickets"));
    const newest = files.find((f) => !f.startsWith("T059") && !f.startsWith("T060-also"));
    expect(newest).toBeDefined();
    expect(newest!.startsWith("T061-")).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests, verify failure**

Run: `cd packages/audit && bun test tests/ticket-gen.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/ticket-gen.ts`**

Create `packages/audit/src/ticket-gen.ts`:

```typescript
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import type { Finding } from "./probe.ts";

export interface GenerateTicketsInput {
  repoRoot: string;
  findings: Finding[];
  topK: number;
}

interface TicketFrontmatter {
  findingId: string;
  probe: string;
  surface: string;
  rule: string;
  severity: string;
  firstSeen: string;
  lastSeen: string;
  status: "open" | "auto-resolved";
}

const RE_TICKET = /^T(\d+)-/;

function highestExistingTicketNumber(ticketsDir: string): number {
  if (!existsSync(ticketsDir)) return 0;
  let max = 0;
  for (const name of readdirSync(ticketsDir)) {
    const m = name.match(RE_TICKET);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

function findingsByExistingTicket(ticketsDir: string): Map<string, string> {
  // Map findingId → existing filename
  const out = new Map<string, string>();
  if (!existsSync(ticketsDir)) return out;
  for (const name of readdirSync(ticketsDir)) {
    if (!RE_TICKET.test(name)) continue;
    try {
      const content = readFileSync(join(ticketsDir, name), "utf-8");
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!fmMatch) continue;
      const fm = yaml.load(fmMatch[1]) as TicketFrontmatter | null;
      if (fm?.findingId) out.set(fm.findingId, name);
    } catch {
      // skip malformed
    }
  }
  return out;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "finding";
}

function atomicWrite(path: string, content: string): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, content);
  renameSync(tmp, path);
}

function ticketBody(f: Finding): string {
  return `# ${f.rule} — ${f.surface} — ${f.location.file}${f.location.line ? `:${f.location.line}` : ""}

## Summary

${f.message}

Detected by probe **\`${f.probe}\`** at \`${f.location.file}${f.location.line ? `:${f.location.line}` : ""}\`. Severity **${f.severity}**, confidence **${f.confidence}**.

## Acceptance Criteria

- [ ] Defect at \`${f.location.file}\` no longer reported by \`${f.probe}\` on next audit run.
- [ ] Tests covering this code path remain green.
- [ ] No new defects of the same rule (\`${f.rule}\`) introduced elsewhere.

## TDD Test Shape

Per AGENTS.md, write a test that demonstrates the defect first. For \`${f.rule}\`, the existing test fixtures or a new targeted unit test should fail before the fix and pass after.

## Files Affected

- \`${f.location.file}\`
${f.suggestedFix ? `\n## Suggested Fix\n\n${f.suggestedFix}\n` : ""}
`;
}

export async function generateTickets(input: GenerateTicketsInput): Promise<{ created: number; updated: number; resolved: number }> {
  const ticketsDir = join(input.repoRoot, "docs", "tickets");
  mkdirSync(ticketsDir, { recursive: true });

  const top = input.findings.slice(0, input.topK);
  const existing = findingsByExistingTicket(ticketsDir);
  let nextNum = highestExistingTicketNumber(ticketsDir) + 1;

  let created = 0;
  let updated = 0;
  let resolved = 0;

  // Create new tickets / update existing ones for top-K findings
  const seenIds = new Set<string>();
  for (const f of top) {
    seenIds.add(f.id);
    const existingName = existing.get(f.id);
    const fm: TicketFrontmatter = {
      findingId: f.id,
      probe: f.probe,
      surface: f.surface,
      rule: f.rule,
      severity: f.severity,
      firstSeen: f.firstSeen,
      lastSeen: f.lastSeen,
      status: "open",
    };
    const yamlFm = yaml.dump(fm);
    const fullContent = `---\n${yamlFm}---\n\n${ticketBody(f)}`;

    if (existingName) {
      atomicWrite(join(ticketsDir, existingName), fullContent);
      updated++;
    } else {
      const filename = `T${String(nextNum).padStart(3, "0")}-${slugify(`${f.probe}-${f.rule}-${f.surface}-${f.location.file.split("/").pop()}`)}.md`;
      atomicWrite(join(ticketsDir, filename), fullContent);
      nextNum++;
      created++;
    }
  }

  // Mark tickets whose finding disappeared as auto-resolved
  for (const [findingId, filename] of existing.entries()) {
    if (seenIds.has(findingId)) continue;
    const path = join(ticketsDir, filename);
    const content = readFileSync(path, "utf-8");
    if (content.includes("status: auto-resolved")) continue; // already resolved
    const updatedContent = content.replace(/status:\s*open/, "status: auto-resolved");
    if (updatedContent !== content) {
      atomicWrite(path, updatedContent);
      resolved++;
    }
  }

  return { created, updated, resolved };
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/audit && bun test tests/ticket-gen.test.ts`
Expected: 4 pass.

- [ ] **Step 5: Commit**

```bash
cd /home/dev/rox/rox-one-terminal
git add packages/audit/src/ticket-gen.ts packages/audit/tests/ticket-gen.test.ts
git -c user.name="Mark Lindgreen" -c user.email="mark@agisota.com" commit -m "feat(audit): ticket-gen creates AGENTS.md ticket stubs from findings [T064]"
```

---

## Task 21: ticket-gen — idempotency invariants (TDD)

**Files:**
- Modify: `packages/audit/tests/ticket-gen.test.ts` — add idempotency tests

- [ ] **Step 1: Append idempotency tests**

Append to `packages/audit/tests/ticket-gen.test.ts`:

```typescript
describe("generateTickets — idempotency", () => {
  test("re-run on same findings creates 0 new tickets", async () => {
    const findings = [baseFinding({ id: "aaaa1111aaaa1111", rule: "tsc:TS2345" })];
    await generateTickets({ repoRoot: dir, findings, topK: 50 });
    const filesAfterFirstRun = readdirSync(join(dir, "docs/tickets"));
    await generateTickets({ repoRoot: dir, findings, topK: 50 });
    const filesAfterSecondRun = readdirSync(join(dir, "docs/tickets"));
    expect(filesAfterSecondRun.length).toBe(filesAfterFirstRun.length);
  });

  test("re-run with mutated lastSeen updates ticket but does not create new file", async () => {
    const id = "abcd5678abcd5678";
    await generateTickets({
      repoRoot: dir,
      findings: [baseFinding({ id, lastSeen: "2026-05-09T11:00:00Z" })],
      topK: 50,
    });
    const filesAfterFirst = readdirSync(join(dir, "docs/tickets"));
    expect(filesAfterFirst.length).toBe(1);

    await generateTickets({
      repoRoot: dir,
      findings: [baseFinding({ id, lastSeen: "2026-05-09T12:30:00Z" })],
      topK: 50,
    });
    const filesAfterSecond = readdirSync(join(dir, "docs/tickets"));
    expect(filesAfterSecond.length).toBe(1);
    const updatedContent = readFileSync(join(dir, "docs/tickets", filesAfterSecond[0]), "utf-8");
    expect(updatedContent).toContain("lastSeen: '2026-05-09T12:30:00Z'");
  });

  test("removed finding causes ticket to be marked auto-resolved", async () => {
    const id = "deadbeefdeadbeef";
    await generateTickets({ repoRoot: dir, findings: [baseFinding({ id })], topK: 50 });
    await generateTickets({ repoRoot: dir, findings: [], topK: 50 });
    const files = readdirSync(join(dir, "docs/tickets"));
    expect(files.length).toBe(1);
    const content = readFileSync(join(dir, "docs/tickets", files[0]), "utf-8");
    expect(content).toContain("status: auto-resolved");
    expect(content).not.toContain("status: open");
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd packages/audit && bun test tests/ticket-gen.test.ts`
Expected: 7 pass (4 prior + 3 new).

- [ ] **Step 3: Commit**

```bash
cd /home/dev/rox/rox-one-terminal
git add packages/audit/tests/ticket-gen.test.ts
git -c user.name="Mark Lindgreen" -c user.email="mark@agisota.com" commit -m "test(audit): ticket-gen idempotency invariants [T064]"
```

---

## Task 22: Wire ticket-gen into CLI

**Files:**
- Modify: `packages/audit/src/cli.ts`

- [ ] **Step 1: Add `--no-tickets` flag and ticket-gen call after reporters**

Modify `packages/audit/src/cli.ts`. Add `--no-tickets` to argv parsing (default false → tickets are generated by default), and call `generateTickets(...)` after `writeMarkdownSidecar`. Add a `--top-k=` flag (default 50).

Add this import at the top:

```typescript
import { generateTickets } from "./ticket-gen.ts";
```

Add to `parseArgs` return type and parsing:

```typescript
  // ...
  let noTickets = false;
  let topK = 50;
  for (const arg of args.slice(2)) {
    // ... existing if-else chain ...
    else if (arg === "--no-tickets") noTickets = true;
    else if (arg.startsWith("--top-k=")) topK = Math.max(1, parseInt(arg.slice("--top-k=".length), 10) || 50);
  }
  return { command: "run", surfaces, probesGlob, workerCap, outOverride, noTickets, topK };
```

Update the return type of `parseArgs` and the destructure in `main()` accordingly.

In `main()`, after `await writeMarkdownSidecar(...)`, add:

```typescript
  if (!parsed.noTickets) {
    const tg = await generateTickets({ repoRoot: workspaceRoot, findings: ranked, topK: parsed.topK });
    process.stdout.write(`tickets: ${tg.created} created, ${tg.updated} updated, ${tg.resolved} resolved\n`);
  }
```

- [ ] **Step 2: Update CLI smoke test (no test breakage expected; verify)**

Run: `cd packages/audit && bun test tests/cli.test.ts`
Expected: All pass.

- [ ] **Step 3: Run full package tests**

Run: `cd packages/audit && bun test`
Expected: 36 pass.

- [ ] **Step 4: Commit**

```bash
cd /home/dev/rox/rox-one-terminal
git add packages/audit/src/cli.ts
git -c user.name="Mark Lindgreen" -c user.email="mark@agisota.com" commit -m "feat(audit): wire ticket-gen into CLI with --no-tickets and --top-k flags [T064]"
```

---

## Task 23: First end-to-end audit run + INDEX.md log

**Files:**
- Create: `docs/audits/INDEX.md`
- Run-time: `audits/<timestamp>/queue.json`, `queue.md`, `manifest.json`
- Run-time: `docs/tickets/T065-T*.md` (from real findings)

- [ ] **Step 1: Add `bun run audit` to root package.json**

Modify root `package.json`. In the `"scripts"` block, add (place it alphabetically near `"audit:..."` or after `"viewer:..."`):

```
    "audit": "bun run packages/audit/src/cli.ts",
    "audit:smoke": "bun run packages/audit/src/cli.ts run renderer --probes=static-tsc --out=audits/_smoke",
    "validate:audit": "bun run audit:smoke",
```

Then update the `"validate:ci"` chain so `validate:audit` runs near the end (after `validate:dev` but before `lint:i18n:*`):

Current:
```
"validate:ci": "bun run validate:agent-contract && bun run validate:architecture-docs && bun run validate:ci-contract && bun run validate:private-release-pipeline && bun run validate:dev && bun run lint:i18n:parity && bun run lint:i18n:sorted && bun run lint:i18n:coverage",
```

New:
```
"validate:ci": "bun run validate:agent-contract && bun run validate:architecture-docs && bun run validate:ci-contract && bun run validate:private-release-pipeline && bun run validate:dev && bun run validate:audit && bun run lint:i18n:parity && bun run lint:i18n:sorted && bun run lint:i18n:coverage",
```

- [ ] **Step 2: Run the smoke**

Run from repo root: `bun run audit:smoke`
Expected: exits 0, prints "audit run complete: N findings, ... ms" + "tickets: N created, 0 updated, 0 resolved".
Inspect: `audits/_smoke/queue.json`, `audits/_smoke/manifest.json` exist.

- [ ] **Step 3: Run a real audit pass over all four surfaces with all static probes**

Run from repo root: `bun run audit run renderer,webui,viewer,marketing --probes=static-*`
Expected: writes a fresh `audits/<timestamp>/` and creates ticket stubs in `docs/tickets/`.
Note: this WILL surface real defects in the codebase. That is the point.

- [ ] **Step 4: Capture the run summary in `docs/audits/INDEX.md`**

Create `docs/audits/INDEX.md`:

```markdown
# Audit Index

Append-only log of audit runs. Most recent at the top.

| Timestamp | Probes | Surfaces | Findings | Critical | High | Medium | Low | Queue | Tickets created |
|---|---|---|---|---|---|---|---|---|---|
| _filled by first run_ | | | | | | | | | |
```

Then add the row for the just-completed run (use the actual numbers from the run output):

```markdown
| 2026-05-09T<HH-MM-SS>Z | static-* | renderer,webui,viewer,marketing | <N> | <Nc> | <Nh> | <Nm> | <Nl> | `audits/<timestamp>/queue.json` | <Ntickets> |
```

- [ ] **Step 5: Commit ONLY the persistent artifacts (NOT the run dir)**

```bash
cd /home/dev/rox/rox-one-terminal
git status --short
# expect: ?? docs/audits/INDEX.md, ?? docs/tickets/T*.md, M package.json
git add package.json docs/audits/INDEX.md docs/tickets/T*.md
git -c user.name="Mark Lindgreen" -c user.email="mark@agisota.com" commit -m "feat(audit): wire audit:smoke into validate:ci, first end-to-end run [T064]"
```

Note: `audits/<timestamp>/` is gitignored (per Task 1 Step 7) so it stays local.

---

## Task 24: T064 ticket + worklog (final phase ticket)

- [ ] **Step 1: Write T064 ticket** — `docs/tickets/T064-ticket-gen-and-first-run.md` covering: ticket-gen module, idempotency invariants, CLI wiring, first end-to-end run, INDEX.md format, validate:ci integration.

- [ ] **Step 2: Write T064 worklog** — `docs/worklog/T064-ticket-gen-and-first-run.md` with 11 AGENTS.md sections including: actual finding count from the first real run, first ticket numbers minted, validate:ci pipeline timing impact.

- [ ] **Step 3: Commit**

```bash
cd /home/dev/rox/rox-one-terminal
git add docs/tickets/T064-ticket-gen-and-first-run.md docs/worklog/T064-ticket-gen-and-first-run.md
git -c user.name="Mark Lindgreen" -c user.email="mark@agisota.com" commit -m "docs(audit): T064 ticket + worklog with first-run results"
```

---

## Task 25: README.md root section

**Files:**
- Modify: `README.md` (root)

- [ ] **Step 1: Add an `## Audit harness` section near the bottom (before the License section)**

Insert into root `README.md` before `## License`:

```markdown
## Audit harness

A static + runtime + LLM-taste + E2E defect catalog for the four user-facing UIs. Findings rank into a prioritized queue and become AGENTS.md-format ticket stubs that team executor agents drain.

```bash
# Smoke (CI-safe, single probe + single surface)
bun run audit:smoke

# Full static run across all surfaces
bun run audit run renderer,webui,viewer,marketing --probes=static-*

# Filter to a single probe
bun run audit run renderer --probes=static-tsc

# Useful flags
#   --top-k=50         max ticket stubs created per run (default 50)
#   --no-tickets       run probes but skip ticket generation
#   --worker-cap=4     parallel probe-surface pairs (default 4)
#   --out=<dir>        output dir override
```

- Output (gitignored, raw): `audits/<timestamp>/queue.json` + `queue.md` + `manifest.json` + `per-probe/*`.
- Output (committed, agent-facing): `docs/tickets/T<N>-*.md` + `docs/audits/INDEX.md`.
- Spec: [`docs/superpowers/specs/2026-05-09-audit-harness-design.md`](docs/superpowers/specs/2026-05-09-audit-harness-design.md).
- Phase A.1 (this release): static probes (`tsc`, `eslint`, `bundle`). Runtime + axe-core (A.2), LLM taste (A.3), E2E user flows (A.4) ship later.
```

- [ ] **Step 2: Commit**

```bash
cd /home/dev/rox/rox-one-terminal
git add README.md
git -c user.name="Mark Lindgreen" -c user.email="mark@agisota.com" commit -m "docs(audit): root README section [T064]"
```

---

## Task 26: Coverage gate

**Files:**
- Modify: `package.json` (root) — add coverage check
- Modify: `packages/audit/package.json` — add coverage script

- [ ] **Step 1: Add coverage script in package**

Modify `packages/audit/package.json`. Add to scripts:

```json
    "test:coverage": "bun test --coverage",
    "test:coverage:check": "bun test --coverage --coverage-reporter=text 2>&1 | awk '/^All files/ {if ($4+0 < 80) {print \"Coverage below 80%\"; exit 1} else {print \"Coverage OK\"}}'"
```

- [ ] **Step 2: Run the coverage check locally**

Run: `cd packages/audit && bun run test:coverage:check`
Expected: prints "Coverage OK" or fails with current numbers. If below 80%, identify the gap and add tests until it passes (each ticket's TDD tests should already cover most branches; gaps usually live in error-paths of the CLI or reporters).

- [ ] **Step 3: Commit if coverage passes**

```bash
cd /home/dev/rox/rox-one-terminal
git add packages/audit/package.json
git -c user.name="Mark Lindgreen" -c user.email="mark@agisota.com" commit -m "test(audit): coverage script with 80% gate [T064]"
```

---

## Task 27: Phase A.1 acceptance gate verification

**Files:**
- (no files modified — verification only, plus optional final commit if any drift surfaces)

- [ ] **Step 1: Verify all sub-criteria from the spec § A.1 acceptance gate**

Run each of these and confirm pass:

```bash
cd /home/dev/rox/rox-one-terminal

# 1. All package tests green
cd packages/audit && bun test
# Expected: 36+ pass, 0 fail

# 2. Branch coverage ≥80%
bun run test:coverage:check
# Expected: "Coverage OK"

# 3. Repo typecheck still green
cd ../.. && bun run typecheck:all
# Expected: exits 0

# 4. validate:ci still passes (audit:smoke included)
bun run validate:ci
# Expected: exits 0 (will take a few minutes)

# 5. Real audit run produces non-zero findings
bun run audit run renderer,webui,viewer,marketing --probes=static-*
# Expected: prints non-zero finding count, ticket count

# 6. INDEX.md row exists for the run
grep -c "static-\*" docs/audits/INDEX.md
# Expected: ≥1
```

- [ ] **Step 2: List which spec criteria are green**

Update `docs/worklog/T064-ticket-gen-and-first-run.md` § 11 acceptance criteria matrix to mark each item green/red with evidence.

- [ ] **Step 3: Hand off to architect agent for verification (per OMC verification protocol)**

The brainstorming spec § 14 mandates "architect agent verification pass — verifier in separate context, not the implementer." Do NOT mark Phase A.1 done from inside the implementing session. Instead:

```
Use OMC's architect agent (separate context) to verify:
1. Reads docs/superpowers/specs/2026-05-09-audit-harness-design.md
2. Reads docs/superpowers/plans/2026-05-09-audit-harness-a1-static-probes.md
3. Reads the latest commits on feat/audit-a1-static
4. Runs the validation commands in Step 1
5. Reports green / red criteria + open issues
```

In Claude Code: `Agent(subagent_type="architect", prompt="Verify Phase A.1 of audit harness against spec docs/superpowers/specs/2026-05-09-audit-harness-design.md and plan docs/superpowers/plans/2026-05-09-audit-harness-a1-static-probes.md. Working tree at /home/dev/rox/rox-one-terminal on branch feat/audit-a1-static. Run the validation commands listed in Task 27 Step 1. Report criterion-by-criterion green/red.")`.

- [ ] **Step 4: If architect verification passes, commit a final acceptance row**

If verification is green, append a `Phase A.1 verified` line to `docs/audits/INDEX.md` and commit:

```bash
cd /home/dev/rox/rox-one-terminal
git add docs/audits/INDEX.md docs/worklog/T064-ticket-gen-and-first-run.md
git -c user.name="Mark Lindgreen" -c user.email="mark@agisota.com" commit -m "chore(audit): Phase A.1 acceptance verified by architect [T060-T064]"
```

- [ ] **Step 5: Phase A.1 ships — handoff signal**

`feat/audit-a1-static` branch is ready for PR review. Do NOT push to `origin/main` from this plan (per user's "no direct main pushes" rule). User opens PR manually or uses `gh pr create` after architect verification is green.

---

## Plan self-review

Reviewing this plan against the spec:

**1. Spec coverage (mapping spec sections → tasks):**
- § 4.3 Probe interface → Task 2 ✓
- § 4 Architecture / components → Tasks 1, 2, 3, 6, 7, 8, 9 ✓
- § 5 Data flow / output artifacts → Tasks 7, 8, 20, 23 ✓
- § 5.2 Idempotency invariant → Task 21 ✓
- § 6 Ranking algorithm → Task 6 ✓
- § 7 Surface ↔ probe applicability matrix → Tasks 12, 15, 18 (`applicableTo` returns true for all four; `e2e-flows` deferred to A.4 plan) ✓
- § 8 Error handling → Task 5 ✓
- § 10 Testing strategy / TDD → Every task ✓
- § 10.6 Coverage gate → Task 26 ✓
- § 11.1 Phase A.1 tickets T060–T064 → Tasks 10, 13, 16, 19, 24 ✓
- § 11.1 A.1 acceptance gate → Task 27 ✓
- § 12 Worklog format → Tasks 10, 13, 16, 19, 24 ✓
- § 13 Branching & commits → Plan-wide branch + per-task commits ✓
- § 14 Definition of done (architect verification) → Task 27 Step 3 ✓

**2. Placeholder scan:** No "TBD", "TODO", "implement later", "Add appropriate error handling". Every step has either exact code or exact commands.

**3. Type consistency:**
- `Probe.run` signature: `(ctx: ProbeContext) => Promise<Finding[]>` consistent across Task 2 declaration and Tasks 12/15/18 implementations ✓
- `Finding.id` is 16 hex chars in Task 2, asserted as such in Task 12 ✓
- `RegistryRunResult.findings` shape matches `Finding[]` from Task 2 ✓
- `writeJsonQueue` input shape (Task 7) matches the call site in Task 9 CLI and Task 23 ✓
- `generateTickets` input shape (Task 20) matches the call site in Task 22 ✓

**4. Type-name drift:**
- `staticTscProbe`, `staticEslintProbe`, `staticBundleProbe` consistent across all tasks ✓
- `computeFindingId` consistent (used in Tasks 2, 5, 12, 15, 18) ✓
- `FINDING_SCHEMA_VERSION` constant consistent (Tasks 2, 5, 7, 12, 15, 18) ✓

No drift detected. Plan is internally consistent.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-09-audit-harness-a1-static-probes.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task (using `superpowers:subagent-driven-development`), review between tasks, fast iteration, separate review context per task. Best for a 27-task plan because each task is small enough for a single subagent and review-between-tasks catches drift early.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints for review. Lower coordination overhead but everything runs in one context window — risk of attention drift across 27 tasks.

**Which approach?**
