/**
 * ROX.ONE Master Orchestrator — shared TypeScript types.
 *
 * Ground-truth type system for the parallel-worktree harness.
 * All other orchestrator modules (state, merge-gate, linear-sync, featurebase-sync,
 * three-machine-verify, coordinator-template, master) import from here.
 *
 * Generated 2026-05-21. See:
 *   docs/superpowers/specs/2026-05-21-rox-one-parallel-worktree-harness-master.md
 *   (Sections 3.1 yaml schema, 3.2 coordinator state schema, 4 14-role swarm,
 *    6 merge gate; v2 §11-§17 multi-axis mission control)
 */

// ============================================================================
//  Enums / Unions
// ============================================================================

export type Wave = 0 | 1 | 2 | 3;
export const ALL_WAVES: readonly Wave[] = [0, 1, 2, 3] as const;

export type Priority = "P0" | "P1" | "P2" | "P3";
export const ALL_PRIORITIES: readonly Priority[] = ["P0", "P1", "P2", "P3"] as const;

export type ReleaseCut =
  | "foundation"
  | "auth"
  | "notifications"
  | "storage"
  | "agent"
  | "ui"
  | "sources";

export const ALL_RELEASE_CUTS: readonly ReleaseCut[] = [
  "foundation", "auth", "notifications", "storage", "agent", "ui", "sources",
] as const;

/** 5-phase lifecycle. Each phase contains multiple gates (master v2 §12). */
export type Phase = "discovery" | "design" | "impl" | "verify" | "optimize";
export const ALL_PHASES: readonly Phase[] = ["discovery", "design", "impl", "verify", "optimize"] as const;

export type CoordinatorPhase = Phase | "merged" | "cancelled";

/**
 * 14-role swarm baseline + 8 v2 additions = 22 roles total (master v2 §13).
 */
export type Role =
  // Discovery
  | "brainstormer" | "requirements-keeper" | "scope-analyzer" | "critic"
  // Design
  | "prompt-writer" | "architect" | "ux-guru"
  // Implementation
  | "test-writer" | "implementer" | "super-coder" | "reviewer"
  // Verification
  | "verifier" | "integrator"
  // Optimization
  | "optimizer" | "10x-improver"
  // v2 additions
  | "cjm-writer" | "erd-writer" | "sequence-chart-writer" | "ui-inventory-writer"
  | "data-refresh-rule-keeper" | "observability-engineer"
  | "risk-board-tracker" | "dependency-graph-tracker";

export const ALL_ROLES: readonly Role[] = [
  "brainstormer", "requirements-keeper", "scope-analyzer", "critic",
  "prompt-writer", "architect", "ux-guru",
  "test-writer", "implementer", "super-coder", "reviewer",
  "verifier", "integrator",
  "optimizer", "10x-improver",
  "cjm-writer", "erd-writer", "sequence-chart-writer", "ui-inventory-writer",
  "data-refresh-rule-keeper", "observability-engineer",
  "risk-board-tracker", "dependency-graph-tracker",
] as const;

/**
 * Model selection per master doc §2.5:
 * opus-4.7 MAX for test/verify/plan/prompt/brainstorm/critique/orchestration;
 * sonnet-4.6 MEDIUM for tactical impl.
 */
export type Model = "opus-4.7-max" | "sonnet-4.6-medium";

export type Machine = "mac-14-arm" | "windows-2022" | "ubuntu-22";
export const ALL_MACHINES: readonly Machine[] = ["mac-14-arm", "windows-2022", "ubuntu-22"] as const;

export type PhaseStatus = "pending" | "in_progress" | "complete" | "blocked";
export type RoleInvocationStatus = "in_progress" | "success" | "failed";

export type LinearStatus =
  | "Triage" | "Backlog" | "Todo" | "In Progress" | "In Review"
  | "Done" | "Canceled" | "Duplicate";

export type FeaturebaseStatus = "Planned" | "In Progress" | "Shipped";

export type IntegrationType =
  | "reference_only" | "adapter" | "wrapper" | "partial_port" | "plugin"
  | "sidecar" | "rewrite" | "api_bridge" | "data_sync" | "ui_embedding"
  | "direct_reuse" | "dependency" | "concept";

/** Work type classifier from master v2 §11. */
export type WorkType =
  | "process" | "refactor" | "integration" | "new_module" | "greenfield" | "spike";

/** Risk axis from master v2 §11/§15. */
export type RiskAxis =
  | "data" | "security" | "release" | "UI" | "perf" | "legal" | "license";

export type SearchIndexImplication = "index" | "reindex" | "exclude" | "N/A";

// ============================================================================
//  Composite Record Types
// ============================================================================

export interface FeatureFlag {
  name: string | null;
  default: "on" | "off" | null;
  release_cut: ReleaseCut | null;
}

export interface ScaffoldRequest {
  target_file: string;
  target_owner: string;
  reason: string;
  proposed_change_summary: string;
}

export interface RolePlan {
  discovery: Role[];
  design: Role[];
  impl: Role[];
  verify: Role[];
  optimize: Role[];
}

export interface VerificationConfig {
  machines: Machine[];
  screenshots_required: boolean;
  smoke_tests: string[];
  electron_build: boolean;
  packaging_required: boolean;
}

export interface LinearConfig {
  parent_epic_identifier: string;
  child_story_titles: string[];
  existing_issues_to_attach: string[];
}

export interface FeaturebaseConfig {
  board_id: string;
  post_alias: string;
  status_lifecycle: FeaturebaseStatus[];
}

export interface InspirationRepo {
  url: string;
  integration_type: IntegrationType;
  rationale: string;
}

export type DefinitionOfDone = Record<string, boolean>;

/** v2 §15 — mission control axes captured in every WT spec and yaml. */
export interface MissionControl {
  work_type: WorkType;
  cjm_scenarios: string[];
  ui_surfaces: string[];
  entities_touched: string[];
  events_emitted: string[];
  ai_context_packets_touched: string[];
  search_index_implications: SearchIndexImplication;
  heptabase_parity: string | "N/A";
  risk_axes: RiskAxis[];
}

// ============================================================================
//  Top-level WT Metadata Schema
// ============================================================================

export interface WTMeta {
  id: string;  // /^WT-\d+$/
  title: string;
  branch: string;
  base_sha: string;
  worktree_path: string;
  feature_flag: FeatureFlag | null;
  priority: Priority;
  wave: Wave;
  files_allowed: string[];
  files_forbidden: string[];
  depends_on: string[];
  blocks: string[];
  scaffold_requests: ScaffoldRequest[];
  roles: RolePlan;
  model_overrides: Partial<Record<Role, Model>>;
  verification: VerificationConfig;
  linear: LinearConfig;
  featurebase: FeaturebaseConfig | null;
  inspiration_repos: InspirationRepo[];
  definition_of_done: DefinitionOfDone;
  mission_control?: MissionControl;
}

// ============================================================================
//  Coordinator State (per-WT)
// ============================================================================

export interface PhaseProgress {
  status: PhaseStatus;
  artifacts: string[];
  started_at?: string;
  completed_at?: string;
  blockers?: string[];
}

export interface RoleInvocation {
  role: Role;
  model: Model;
  phase: Phase;
  started_at: string;
  completed_at?: string;
  tokens_in?: number;
  tokens_out?: number;
  artifacts: string[];
  status: RoleInvocationStatus;
  error?: string;
}

export interface CoordinatorState {
  wt_id: string;
  current_phase: CoordinatorPhase;
  phase_progress: Record<Phase, PhaseProgress>;
  role_invocations: RoleInvocation[];
  merge_ready: boolean;
  merged_at?: string;
  merged_sha?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
}

// ============================================================================
//  Master Orchestrator State
// ============================================================================

export const ORCHESTRATOR_STATE_SCHEMA_VERSION = 1;

export interface OrchestratorState {
  schema_version: number;
  generated_at: string;
  base_sha: string;
  wt_metas_loaded: number;
  wt_states: Record<string, CoordinatorState>;
  merge_queue: string[];
  merged_count: number;
  release_cuts_executed: ReleaseCut[];
}

// ============================================================================
//  Merge Gate / Verification / Refs
// ============================================================================

export interface MergeGateCheck {
  name: string;
  passed: boolean;
  details?: string;
  blocker?: boolean;
}

export interface MergeGateResult {
  wt_id: string;
  passed: boolean;
  checks: MergeGateCheck[];
  evidence_files: string[];
  ran_at: string;
}

export interface VerificationEvidence {
  machine: Machine;
  screenshot_path?: string;
  build_log_path: string;
  smoke_result_path: string;
  signature_status_path?: string;
  duration_ms: number;
  passed: boolean;
}

export interface LinearIssueRef {
  identifier: string;
  uuid: string;
  url: string;
  status: LinearStatus;
}

export interface FeaturebasePostRef {
  id: string;
  alias: string;
  url: string;
  board_id: string;
  status: FeaturebaseStatus;
}

export interface OrchestratorSummary {
  loaded: number;
  by_phase: Record<string, number>;
  merged: number;
  blocked: string[];
}
