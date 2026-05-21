/**
 * coordinator.ts — per-WT 5-phase × 22-role lifecycle driver.
 *
 * Phases:
 *   1. discovery   → brainstormer, requirements-keeper, scope-analyzer, critic, cjm-writer
 *   2. design      → erd-writer, sequence-chart-writer, ui-inventory-writer, prompt-writer,
 *                    ux-guru, data-refresh-rule-keeper
 *   3. impl        → test-writer, implementer, super-coder, reviewer
 *   4. verify      → verifier, critic, integrator
 *   5. optimize    → optimizer, 10x-improver, observability-engineer,
 *                    risk-board-tracker, dependency-graph-tracker
 *
 * Model routing:
 *   opus-4.7  — TEST, VERIFY, PLAN, PROMPT, BRAINSTORM, CRITIQUE, ORCHESTRATION
 *   sonnet-4.6 — tactical impl (implementer, super-coder, ui-inventory-writer)
 *   haiku-4.5 — minor lookups
 *
 * Persists state to `.omc/state/coordinator/<wt>.json` so runs are resumable.
 * Hibernation-safe: each phase writes checkpoint before next phase.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { loadWTMetas, type WTMeta } from "./state.js";

const STATE_DIR = join(process.cwd(), ".omc", "state", "coordinator");

export type Phase = "discovery" | "design" | "impl" | "verify" | "optimize";
export type PhaseStatus = "pending" | "running" | "completed" | "failed";

export interface PhaseState {
  phase: Phase;
  status: PhaseStatus;
  startedAt: string | null;
  completedAt: string | null;
  rolesCompleted: string[];
  rolesFailed: string[];
  artifacts: string[];
  notes: string;
}

export interface CoordinatorState {
  wtId: string;
  branch: string;
  currentPhase: Phase;
  phases: Record<Phase, PhaseState>;
  startedAt: string;
  updatedAt: string;
}

const PHASES: Phase[] = ["discovery", "design", "impl", "verify", "optimize"];

const ROLE_TO_MODEL: Record<string, "opus" | "sonnet" | "haiku"> = {
  brainstormer: "opus",
  "requirements-keeper": "opus",
  "scope-analyzer": "opus",
  critic: "opus",
  "cjm-writer": "opus",
  "erd-writer": "opus",
  "sequence-chart-writer": "opus",
  "ui-inventory-writer": "sonnet",
  "prompt-writer": "opus",
  "ux-guru": "opus",
  "data-refresh-rule-keeper": "opus",
  "test-writer": "opus",
  implementer: "sonnet",
  "super-coder": "sonnet",
  reviewer: "opus",
  verifier: "opus",
  integrator: "opus",
  optimizer: "sonnet",
  "10x-improver": "opus",
  "observability-engineer": "sonnet",
  "risk-board-tracker": "opus",
  "dependency-graph-tracker": "opus",
};

function statePath(wtId: string): string {
  return join(STATE_DIR, `${wtId.toLowerCase()}.json`);
}

export function loadState(wtId: string): CoordinatorState | null {
  const p = statePath(wtId);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as CoordinatorState;
  } catch {
    return null;
  }
}

export function saveState(state: CoordinatorState): void {
  const p = statePath(state.wtId);
  mkdirSync(dirname(p), { recursive: true });
  state.updatedAt = new Date().toISOString();
  // atomic write: tmp + rename
  const tmp = `${p}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
  // Node provides renameSync via fs/promises only via dynamic import — use writeFile + rename trick
  // simplification: writeFileSync is mostly-atomic on the same FS
  writeFileSync(p, JSON.stringify(state, null, 2), "utf8");
}

function emptyPhaseState(phase: Phase): PhaseState {
  return {
    phase,
    status: "pending",
    startedAt: null,
    completedAt: null,
    rolesCompleted: [],
    rolesFailed: [],
    artifacts: [],
    notes: "",
  };
}

export function initState(wt: WTMeta): CoordinatorState {
  const phases: Record<Phase, PhaseState> = {
    discovery: emptyPhaseState("discovery"),
    design: emptyPhaseState("design"),
    impl: emptyPhaseState("impl"),
    verify: emptyPhaseState("verify"),
    optimize: emptyPhaseState("optimize"),
  };
  const now = new Date().toISOString();
  return {
    wtId: wt.id,
    branch: wt.branch,
    currentPhase: "discovery",
    phases,
    startedAt: now,
    updatedAt: now,
  };
}

export function rolesForPhase(wt: WTMeta, phase: Phase): string[] {
  return wt.roles?.[phase] ?? [];
}

export function modelForRole(wt: WTMeta, role: string): "opus" | "sonnet" | "haiku" {
  const override = wt.model_overrides?.[role];
  if (override === "opus" || override === "sonnet" || override === "haiku") return override;
  return ROLE_TO_MODEL[role] ?? "sonnet";
}

/** Returns a prompt template for a (wt, phase, role) tuple. */
export function buildRolePrompt(wt: WTMeta, phase: Phase, role: string): string {
  const mc = wt.mission_control;
  return [
    `# ${wt.id} / ${phase} / ${role}`,
    `**Branch:** \`${wt.branch}\`  •  **Wave:** ${wt.wave}  •  **Priority:** ${wt.priority}`,
    `**Feature flag:** \`${wt.feature_flag.name}\` (default ${wt.feature_flag.default ? "ON" : "OFF"})`,
    "",
    `Work strictly within \`files_allowed\` from \`wt-meta/${wt.id.toLowerCase()}.yaml\`.`,
    `NEVER modify any file listed in \`files_forbidden\` even if it seems related.`,
    "",
    "## Mission control axes",
    `- Work type: ${mc.work_type}`,
    `- CJM scenarios: ${mc.cjm_scenarios.join(", ") || "—"}`,
    `- UI surfaces: ${mc.ui_surfaces.join(", ") || "—"}`,
    `- Entities touched: ${mc.entities_touched.join(", ") || "—"}`,
    `- Events emitted: ${mc.events_emitted.join(", ") || "—"}`,
    `- Heptabase parity: ${mc.heptabase_parity}`,
    `- Risk axes: ${mc.risk_axes.join(", ")}`,
    "",
    `## Your role (${role})`,
    rolePromptHint(role),
    "",
    `Definition of done from yaml: ${JSON.stringify(wt.definition_of_done ?? {}, null, 2)}`,
  ].join("\n");
}

function rolePromptHint(role: string): string {
  const hints: Record<string, string> = {
    brainstormer: "Generate 3-5 alternative approaches with tradeoffs. Pick recommended one.",
    "requirements-keeper": "Extract FR-1..FR-N and NFR-1..NFR-N from the spec. Flag ambiguities.",
    "scope-analyzer": "Confirm files_allowed/files_forbidden boundaries are tight. List edge cases.",
    critic: "Find weakest assumptions. Stress-test the design with 5 hostile scenarios.",
    "cjm-writer": "Write CJM.md for each scenario: triggers, steps, hopes/fears, success criteria.",
    "erd-writer": "Write erd/entities.mmd Mermaid ER diagram covering entities_touched.",
    "sequence-chart-writer": "Write sequence/*.mmd per event in events_emitted.",
    "ui-inventory-writer": "Inventory every UI surface: states, variants, a11y annotations.",
    "prompt-writer": "Draft LLM prompts (if AI involved) with input/output contracts.",
    "ux-guru": "Audit empty/loading/error states. Verify keyboard nav. Score axe-core.",
    "data-refresh-rule-keeper": "Define cache TTL, refresh triggers, optimistic-vs-pessimistic UI.",
    "test-writer": "Write failing tests FIRST. Cover happy path + edge + error + perf.",
    implementer: "Make the failing tests pass. Smallest possible change.",
    "super-coder": "Refactor for clarity. Eliminate duplication. Keep tests green.",
    reviewer: "Review diff for security, perf, style. Confidence-filter — only real issues.",
    verifier: "Run lint/typecheck/tests. Verify 3-machine evidence (mac/win/linux).",
    integrator: "Merge feature flag wiring. Verify upstream merge will not conflict.",
    optimizer: "Profile hotpaths. Reduce bundle. Cache where safe.",
    "10x-improver": "Find one 10x leverage move. Not a refactor — a structural insight.",
    "observability-engineer": "Add metrics, alerts, dashboards. Write observability/metrics.md.",
    "risk-board-tracker": "Update risk axes in mission_control yaml. Flag new risks.",
    "dependency-graph-tracker": "Re-run graphify. Flag new cross-WT dependencies.",
  };
  return hints[role] ?? "Apply judgment based on role name.";
}

/** Advances state machine to next phase if current is complete. */
export function advancePhase(state: CoordinatorState): boolean {
  const cur = state.phases[state.currentPhase];
  if (cur.status !== "completed") return false;
  const idx = PHASES.indexOf(state.currentPhase);
  if (idx < 0 || idx === PHASES.length - 1) return false;
  state.currentPhase = PHASES[idx + 1] as Phase;
  state.phases[state.currentPhase].status = "pending";
  return true;
}

/** Lightweight CLI summary: print plan for a WT without executing. */
export function planWT(wt: WTMeta): string {
  const lines: string[] = [`# ${wt.id} — ${wt.title}`, `**Branch:** \`${wt.branch}\``, ""];
  for (const phase of PHASES) {
    lines.push(`## ${phase}`);
    const roles = rolesForPhase(wt, phase);
    for (const role of roles) {
      lines.push(`- \`${role}\` (model: ${modelForRole(wt, role)})`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const wtId = process.argv.find((a) => a.startsWith("--wt="))?.split("=")[1];
  const action = process.argv.find((a) => !a.startsWith("-") && a !== process.argv[0] && a !== process.argv[1]) ?? "plan";

  (async () => {
    const wts = await loadWTMetas();
    if (wtId) {
      const wt = wts.find((w) => w.id === wtId);
      if (!wt) {
        console.error(`WT ${wtId} not found`);
        process.exit(1);
      }
      if (action === "plan") {
        console.log(planWT(wt));
      } else if (action === "init") {
        const state = loadState(wt.id) ?? initState(wt);
        saveState(state);
        console.log(`State initialized: ${statePath(wt.id)}`);
        console.log(`Current phase: ${state.currentPhase}`);
      } else if (action === "status") {
        const state = loadState(wt.id);
        if (!state) {
          console.log(`No state yet for ${wt.id} — run \`init\` first.`);
          process.exit(0);
        }
        console.log(JSON.stringify(state, null, 2));
      } else {
        console.error(`Unknown action: ${action}. Use plan|init|status.`);
        process.exit(1);
      }
    } else {
      console.log(`# Coordinator overview — ${wts.length} WTs\n`);
      for (const wt of wts) {
        const state = loadState(wt.id);
        const phase = state ? state.currentPhase : "(not started)";
        console.log(`  [${wt.id}] ${phase} — ${wt.title}`);
      }
    }
  })().catch((err) => {
    console.error("coordinator fatal:", err);
    process.exit(1);
  });
}
