/**
 * ROX.ONE Master Orchestrator — state and wt-meta loaders.
 *
 * Public surface:
 *   - loadWTMetas(repoRoot)            — parse all wt-meta/wt-*.yaml
 *   - loadOrchestratorState(repoRoot)  — read .orchestrator/state.json
 *   - saveOrchestratorState(...)       — atomic write
 *   - loadCoordinatorState(...)        — read .coordinator/<wt-id>/state.json
 *   - saveCoordinatorState(...)        — atomic write
 *   - topologicalSort(metas)           — by depends_on; throws on cycle
 *   - validateWTMeta(raw)              — runtime check, throws with path
 *   - summarizeState(state)            — projection for `master status`
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import yaml from "js-yaml";
import {
  ALL_MACHINES,
  ALL_PHASES,
  ALL_PRIORITIES,
  ALL_RELEASE_CUTS,
  ALL_ROLES,
  ALL_WAVES,
  type CoordinatorState,
  type DefinitionOfDone,
  type FeatureFlag,
  type FeaturebaseConfig,
  type InspirationRepo,
  type IntegrationType,
  type LinearConfig,
  type Machine,
  type MissionControl,
  type Model,
  type OrchestratorState,
  type OrchestratorSummary,
  ORCHESTRATOR_STATE_SCHEMA_VERSION,
  type Phase,
  type Priority,
  type ReleaseCut,
  type RiskAxis,
  type Role,
  type RolePlan,
  type ScaffoldRequest,
  type SearchIndexImplication,
  type VerificationConfig,
  type Wave,
  type WorkType,
  type WTMeta,
} from "./types.js";

const STATE_PATH = ".orchestrator/state.json";
const WT_META_DIR = "wt-meta";
const COORDINATOR_STATE_DIR = ".coordinator";

const VALID_INTEGRATION_TYPES = new Set<IntegrationType>([
  "reference_only", "adapter", "wrapper", "partial_port", "plugin",
  "sidecar", "rewrite", "api_bridge", "data_sync", "ui_embedding",
  "direct_reuse", "dependency", "concept",
]);

const VALID_WORK_TYPES = new Set<WorkType>([
  "process", "refactor", "integration", "new_module", "greenfield", "spike",
]);

const VALID_RISK_AXES = new Set<RiskAxis>([
  "data", "security", "release", "UI", "perf", "legal", "license",
]);

const VALID_SEARCH_IMPLICATIONS = new Set<SearchIndexImplication>([
  "index", "reindex", "exclude", "N/A",
]);

const VALID_MODELS = new Set<Model>(["opus-4.7-max", "sonnet-4.6-medium"]);

// ============================================================================
//  Validation helpers
// ============================================================================

class ValidationError extends Error {
  constructor(p: string, msg: string) {
    super(`${p}: ${msg}`);
    this.name = "ValidationError";
  }
}

function expectObject(v: unknown, p: string): Record<string, unknown> {
  if (v === null || typeof v !== "object" || Array.isArray(v)) {
    throw new ValidationError(p, `expected object, got ${typeof v}`);
  }
  return v as Record<string, unknown>;
}

function expectString(v: unknown, p: string): string {
  if (typeof v !== "string") {
    throw new ValidationError(p, `expected string, got ${typeof v}`);
  }
  return v;
}

function expectStringArray(v: unknown, p: string): string[] {
  if (!Array.isArray(v)) {
    throw new ValidationError(p, `expected array of strings, got ${typeof v}`);
  }
  return v.map((x, i) => expectString(x, `${p}[${i}]`));
}

function expectBoolean(v: unknown, p: string): boolean {
  if (typeof v !== "boolean") {
    throw new ValidationError(p, `expected boolean, got ${typeof v}`);
  }
  return v;
}

function expectEnum<T extends string>(
  v: unknown,
  p: string,
  allowed: readonly T[] | Set<T>,
): T {
  const s = expectString(v, p);
  const set = allowed instanceof Set ? allowed : new Set<T>(allowed);
  if (!set.has(s as T)) {
    throw new ValidationError(
      p,
      `expected one of ${[...set].map((x) => JSON.stringify(x)).join(", ")}, got ${JSON.stringify(s)}`,
    );
  }
  return s as T;
}

// ============================================================================
//  Validators
// ============================================================================

/** YAML 1.1 parses bare `off`/`on` as JS booleans. Normalize back to string. */
function normalizeFlagDefault(value: unknown, p: string): "on" | "off" | null {
  if (value === null || value === undefined) return null;
  if (value === true || value === "on") return "on";
  if (value === false || value === "off") return "off";
  throw new ValidationError(p, `expected "on"|"off"|true|false|null, got ${JSON.stringify(value)}`);
}

function validateFeatureFlag(raw: unknown, p: string): FeatureFlag | null {
  if (raw === null || raw === undefined) return null;
  const obj = expectObject(raw, p);
  if (obj.name === null) return { name: null, default: null, release_cut: null };
  return {
    name: expectString(obj.name, `${p}.name`),
    default: normalizeFlagDefault(obj.default, `${p}.default`),
    release_cut: obj.release_cut === null || obj.release_cut === undefined
      ? null
      : expectEnum<ReleaseCut>(obj.release_cut, `${p}.release_cut`, ALL_RELEASE_CUTS),
  };
}

function validateScaffoldRequest(raw: unknown, p: string): ScaffoldRequest {
  const obj = expectObject(raw, p);
  return {
    target_file: expectString(obj.target_file, `${p}.target_file`),
    target_owner: expectString(obj.target_owner, `${p}.target_owner`),
    reason: expectString(obj.reason, `${p}.reason`),
    proposed_change_summary: expectString(obj.proposed_change_summary, `${p}.proposed_change_summary`),
  };
}

function validateRolePlan(raw: unknown, p: string): RolePlan {
  const obj = expectObject(raw, p);
  const parseRoleList = (key: Phase): Role[] => {
    const raw = obj[key];
    if (!Array.isArray(raw)) {
      throw new ValidationError(`${p}.${key}`, `expected array, got ${typeof raw}`);
    }
    return raw.map((r, i) => expectEnum<Role>(r, `${p}.${key}[${i}]`, ALL_ROLES));
  };
  return {
    discovery: parseRoleList("discovery"),
    design: parseRoleList("design"),
    impl: parseRoleList("impl"),
    verify: parseRoleList("verify"),
    optimize: parseRoleList("optimize"),
  };
}

function validateVerificationConfig(raw: unknown, p: string): VerificationConfig {
  const obj = expectObject(raw, p);
  const machinesRaw = obj.machines;
  if (!Array.isArray(machinesRaw)) {
    throw new ValidationError(`${p}.machines`, "expected array");
  }
  return {
    machines: machinesRaw.map((m, i) => expectEnum<Machine>(m, `${p}.machines[${i}]`, ALL_MACHINES)),
    screenshots_required: expectBoolean(obj.screenshots_required, `${p}.screenshots_required`),
    smoke_tests: expectStringArray(obj.smoke_tests ?? [], `${p}.smoke_tests`),
    electron_build: expectBoolean(obj.electron_build, `${p}.electron_build`),
    packaging_required: expectBoolean(obj.packaging_required, `${p}.packaging_required`),
  };
}

function validateLinearConfig(raw: unknown, p: string): LinearConfig {
  const obj = expectObject(raw, p);
  return {
    parent_epic_identifier: expectString(obj.parent_epic_identifier, `${p}.parent_epic_identifier`),
    child_story_titles: expectStringArray(obj.child_story_titles ?? [], `${p}.child_story_titles`),
    existing_issues_to_attach: expectStringArray(
      obj.existing_issues_to_attach ?? [],
      `${p}.existing_issues_to_attach`,
    ),
  };
}

function validateFeaturebaseConfig(raw: unknown, p: string): FeaturebaseConfig | null {
  if (raw === null || raw === undefined) return null;
  const obj = expectObject(raw, p);
  const lifecycleRaw = obj.status_lifecycle ?? ["planned", "in-progress", "shipped"];
  if (!Array.isArray(lifecycleRaw)) {
    throw new ValidationError(`${p}.status_lifecycle`, "expected array");
  }
  return {
    board_id: expectString(obj.board_id, `${p}.board_id`),
    post_alias: expectString(obj.post_alias, `${p}.post_alias`),
    status_lifecycle: lifecycleRaw.map((s, i) =>
      expectEnum(s, `${p}.status_lifecycle[${i}]`, ["planned", "in-progress", "shipped"] as const),
    ),
  };
}

function validateInspirationRepo(raw: unknown, p: string): InspirationRepo {
  const obj = expectObject(raw, p);
  return {
    url: expectString(obj.url, `${p}.url`),
    integration_type: expectEnum<IntegrationType>(
      obj.integration_type,
      `${p}.integration_type`,
      VALID_INTEGRATION_TYPES,
    ),
    rationale: expectString(obj.rationale ?? "", `${p}.rationale`),
  };
}

/** Accept flat map OR array-of-single-key-objects shape. */
function validateDefinitionOfDone(raw: unknown, p: string): DefinitionOfDone {
  if (raw === null || raw === undefined) return {};
  if (Array.isArray(raw)) {
    const result: DefinitionOfDone = {};
    raw.forEach((item, i) => {
      const obj = expectObject(item, `${p}[${i}]`);
      const keys = Object.keys(obj);
      if (keys.length !== 1) {
        throw new ValidationError(`${p}[${i}]`, "expected single-key object");
      }
      const key = keys[0]!;
      result[key] = expectBoolean(obj[key], `${p}[${i}].${key}`);
    });
    return result;
  }
  const obj = expectObject(raw, p);
  const result: DefinitionOfDone = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = expectBoolean(v, `${p}.${k}`);
  }
  return result;
}

function validateMissionControl(raw: unknown, p: string): MissionControl {
  const obj = expectObject(raw, p);
  const riskRaw = obj.risk_axes;
  if (!Array.isArray(riskRaw)) {
    throw new ValidationError(`${p}.risk_axes`, "expected array");
  }
  return {
    work_type: expectEnum<WorkType>(obj.work_type, `${p}.work_type`, VALID_WORK_TYPES),
    cjm_scenarios: expectStringArray(obj.cjm_scenarios ?? [], `${p}.cjm_scenarios`),
    ui_surfaces: expectStringArray(obj.ui_surfaces ?? [], `${p}.ui_surfaces`),
    entities_touched: expectStringArray(obj.entities_touched ?? [], `${p}.entities_touched`),
    events_emitted: expectStringArray(obj.events_emitted ?? [], `${p}.events_emitted`),
    ai_context_packets_touched: expectStringArray(
      obj.ai_context_packets_touched ?? [],
      `${p}.ai_context_packets_touched`,
    ),
    search_index_implications: expectEnum<SearchIndexImplication>(
      obj.search_index_implications ?? "N/A",
      `${p}.search_index_implications`,
      VALID_SEARCH_IMPLICATIONS,
    ),
    heptabase_parity: expectString(obj.heptabase_parity ?? "N/A", `${p}.heptabase_parity`),
    risk_axes: riskRaw.map((r, i) => expectEnum<RiskAxis>(r, `${p}.risk_axes[${i}]`, VALID_RISK_AXES)),
  };
}

function validateModelOverrides(raw: unknown, p: string): Partial<Record<Role, Model>> {
  if (raw === null || raw === undefined) return {};
  const obj = expectObject(raw, p);
  const result: Partial<Record<Role, Model>> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!new Set<string>(ALL_ROLES).has(k)) {
      throw new ValidationError(`${p}.${k}`, "unknown role key");
    }
    result[k as Role] = expectEnum<Model>(v, `${p}.${k}`, VALID_MODELS);
  }
  return result;
}

/**
 * Runtime validation. Returns a parsed, typed WTMeta or throws a ValidationError
 * with a dotted path indicating the bad field.
 */
export function validateWTMeta(raw: unknown): WTMeta {
  const obj = expectObject(raw, "<root>");
  const id = expectString(obj.id, "id");
  if (!/^WT-\d+$/.test(id)) {
    throw new ValidationError("id", `must match /^WT-\\d+$/, got ${JSON.stringify(id)}`);
  }
  // Wave is a number in YAML; accept number directly
  const waveNum = typeof obj.wave === "number" ? (obj.wave as Wave) : Number(obj.wave);
  if (!ALL_WAVES.includes(waveNum as Wave)) {
    throw new ValidationError("wave", `expected one of ${ALL_WAVES.join("|")}, got ${obj.wave}`);
  }
  return {
    id,
    title: expectString(obj.title, "title"),
    branch: expectString(obj.branch, "branch"),
    base_sha: expectString(obj.base_sha, "base_sha"),
    worktree_path: expectString(obj.worktree_path, "worktree_path"),
    feature_flag: validateFeatureFlag(obj.feature_flag, "feature_flag"),
    priority: expectEnum<Priority>(obj.priority, "priority", ALL_PRIORITIES),
    wave: waveNum as Wave,
    files_allowed: expectStringArray(obj.files_allowed ?? [], "files_allowed"),
    files_forbidden: expectStringArray(obj.files_forbidden ?? [], "files_forbidden"),
    depends_on: expectStringArray(obj.depends_on ?? [], "depends_on"),
    blocks: expectStringArray(obj.blocks ?? [], "blocks"),
    scaffold_requests: Array.isArray(obj.scaffold_requests)
      ? obj.scaffold_requests.map((r, i) => validateScaffoldRequest(r, `scaffold_requests[${i}]`))
      : [],
    roles: validateRolePlan(obj.roles, "roles"),
    model_overrides: validateModelOverrides(obj.model_overrides, "model_overrides"),
    verification: validateVerificationConfig(obj.verification, "verification"),
    linear: validateLinearConfig(obj.linear, "linear"),
    featurebase: validateFeaturebaseConfig(obj.featurebase, "featurebase"),
    inspiration_repos: Array.isArray(obj.inspiration_repos)
      ? obj.inspiration_repos.map((r, i) => validateInspirationRepo(r, `inspiration_repos[${i}]`))
      : [],
    definition_of_done: validateDefinitionOfDone(obj.definition_of_done, "definition_of_done"),
    mission_control:
      obj.mission_control === undefined
        ? undefined
        : validateMissionControl(obj.mission_control, "mission_control"),
  };
}

// ============================================================================
//  Loaders
// ============================================================================

export async function loadWTMetas(repoRoot: string): Promise<WTMeta[]> {
  const dir = path.join(repoRoot, WT_META_DIR);
  const files = (await fs.readdir(dir))
    .filter((f) => /^wt-\d+\.yaml$/.test(f))
    .sort();
  const metas: WTMeta[] = [];
  for (const f of files) {
    const fp = path.join(dir, f);
    const text = await fs.readFile(fp, "utf-8");
    let raw: unknown;
    try {
      raw = yaml.load(text);
    } catch (err) {
      throw new Error(`Failed to parse YAML ${f}: ${(err as Error).message}`);
    }
    try {
      metas.push(validateWTMeta(raw));
    } catch (err) {
      throw new Error(`Invalid wt-meta in ${f}: ${(err as Error).message}`);
    }
  }
  return metas;
}

export async function loadOrchestratorState(repoRoot: string): Promise<OrchestratorState> {
  const fp = path.join(repoRoot, STATE_PATH);
  try {
    const text = await fs.readFile(fp, "utf-8");
    return JSON.parse(text) as OrchestratorState;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        schema_version: ORCHESTRATOR_STATE_SCHEMA_VERSION,
        generated_at: new Date().toISOString(),
        base_sha: "",
        wt_metas_loaded: 0,
        wt_states: {},
        merge_queue: [],
        merged_count: 0,
        release_cuts_executed: [],
      };
    }
    throw err;
  }
}

async function atomicWriteJSON(targetPath: string, data: unknown): Promise<void> {
  const dir = path.dirname(targetPath);
  await fs.mkdir(dir, { recursive: true });
  const tmpPath = `${targetPath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    await fs.writeFile(tmpPath, JSON.stringify(data, null, 2) + "\n", "utf-8");
    await fs.rename(tmpPath, targetPath);
  } catch (err) {
    try { await fs.unlink(tmpPath); } catch { /* ignore */ }
    throw err;
  }
}

export async function saveOrchestratorState(repoRoot: string, state: OrchestratorState): Promise<void> {
  await atomicWriteJSON(path.join(repoRoot, STATE_PATH), state);
}

function coordinatorStatePath(repoRoot: string, wtId: string): string {
  return path.join(repoRoot, COORDINATOR_STATE_DIR, wtId, "state.json");
}

export async function loadCoordinatorState(
  repoRoot: string,
  wtId: string,
): Promise<CoordinatorState | null> {
  const fp = coordinatorStatePath(repoRoot, wtId);
  try {
    const text = await fs.readFile(fp, "utf-8");
    return JSON.parse(text) as CoordinatorState;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function saveCoordinatorState(
  repoRoot: string,
  state: CoordinatorState,
): Promise<void> {
  await atomicWriteJSON(coordinatorStatePath(repoRoot, state.wt_id), state);
}

// ============================================================================
//  Topological sort (3-color DFS, cycle detection)
// ============================================================================

export function topologicalSort(metas: WTMeta[]): string[] {
  const byId = new Map<string, WTMeta>();
  for (const m of metas) byId.set(m.id, m);

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const m of metas) color.set(m.id, WHITE);

  const result: string[] = [];

  function visit(id: string, stack: string[]): void {
    const c = color.get(id) ?? WHITE;
    if (c === BLACK) return;
    if (c === GRAY) {
      throw new Error(`Cycle detected: ${[...stack, id].join(" -> ")}`);
    }
    color.set(id, GRAY);
    const meta = byId.get(id);
    if (meta) {
      for (const dep of meta.depends_on) {
        if (!byId.has(dep)) continue;
        visit(dep, [...stack, id]);
      }
    }
    color.set(id, BLACK);
    result.push(id);
  }

  const ids = [...byId.keys()].sort();
  for (const id of ids) {
    if ((color.get(id) ?? WHITE) === WHITE) visit(id, []);
  }
  return result;
}

// ============================================================================
//  Summary projection
// ============================================================================

export function summarizeState(state: OrchestratorState): OrchestratorSummary {
  const by_phase: Record<string, number> = {};
  const blocked: string[] = [];
  for (const [wtId, ws] of Object.entries(state.wt_states)) {
    const phase = ws.current_phase;
    by_phase[phase] = (by_phase[phase] ?? 0) + 1;
    for (const p of ALL_PHASES) {
      if (ws.phase_progress[p]?.status === "blocked") {
        blocked.push(wtId);
        break;
      }
    }
  }
  return {
    loaded: state.wt_metas_loaded,
    by_phase,
    merged: state.merged_count,
    blocked,
  };
}
