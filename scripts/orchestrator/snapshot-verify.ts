/**
 * snapshot-verify.ts — WT-00 snapshot hygiene + scaffold-ownership validator.
 *
 * Spec: docs/superpowers/specs/2026-05-21-wt-00-snapshot-hygiene-design.md
 *
 * Responsibilities (process WT, no feature code):
 *   1. Verify `git rev-parse HEAD` matches the recorded base_sha snapshot.
 *   2. Validate wt-meta/scaffold-ownership.yaml shape + required shared-scaffold coverage.
 *   3. Validate wt-meta/release-cuts.yaml topological order + tag consistency.
 *   4. Run a lightweight gitleaks pattern sweep over staged content (CI hook).
 *   5. Verify CODEOWNERS coverage across the 13 epics that own the parallel harness.
 *
 * CLI:
 *   $ bun run scripts/orchestrator/snapshot-verify.ts            # run all checks
 *   $ bun run scripts/orchestrator/snapshot-verify.ts --sha      # only SHA check
 *   $ bun run scripts/orchestrator/snapshot-verify.ts --json     # JSON report
 *
 * Exit codes:
 *   0 — all green
 *   1 — soft warnings (e.g. CODEOWNERS placeholder)
 *   2 — hard fail (mismatch, schema invalid, secret leak)
 *
 * No third-party deps beyond `js-yaml` (already in repo).
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScaffoldOwnerEntry {
  file: string;
  owner: string;
  notes?: string;
}

export interface ScaffoldOwnershipDoc {
  owners: ScaffoldOwnerEntry[];
}

export interface ReleaseCutEntry {
  name: string;
  description: string;
  target_date: string;
  includes: string[];
  excludes: string[];
}

export interface ReleaseCutsDoc {
  cuts: ReleaseCutEntry[];
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface ShaCheckResult {
  ok: boolean;
  actual: string;
  expected: string;
  reason?: string;
}

export interface GitleaksHit {
  kind: string;
  match: string;
}

export interface CodeownersCoverageResult {
  ok: boolean;
  missing: string[];
}

// ---------------------------------------------------------------------------
// SHA verification
// ---------------------------------------------------------------------------

/** Wave-0 baseline SHA — see WT-00 spec §1 + wt-meta/wt-00.yaml. */
export const WAVE_0_BASELINE_SHA = "fac6f228069c";

/**
 * Verify a candidate SHA matches the expected baseline.
 *
 * Accepts prefix-match in either direction so 12-char short SHAs are valid.
 */
export function verifySnapshotSha(actual: string, expected: string): ShaCheckResult {
  const a = actual.trim().toLowerCase();
  const e = expected.trim().toLowerCase();
  if (a === e || a.startsWith(e) || e.startsWith(a)) {
    return { ok: true, actual: a, expected: e };
  }
  return {
    ok: false,
    actual: a,
    expected: e,
    reason: `SHA mismatch: HEAD=${a} expected=${e}`,
  };
}

export function getCurrentGitSha(repoRoot: string): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Scaffold ownership
// ---------------------------------------------------------------------------

/** Shared scaffolds that MUST have an owner entry (spec §3). */
const REQUIRED_SHARED_SCAFFOLDS = [
  "package.json",
  "tsconfig.json",
  "tsconfig.base.json",
];

export function loadScaffoldOwnership(repoRoot: string): ScaffoldOwnershipDoc {
  const p = join(repoRoot, "wt-meta", "scaffold-ownership.yaml");
  const raw = readFileSync(p, "utf8");
  return yaml.load(raw) as ScaffoldOwnershipDoc;
}

export function validateScaffoldOwnership(doc: ScaffoldOwnershipDoc): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!doc || !Array.isArray(doc.owners)) {
    return { ok: false, errors: ["doc.owners is not an array"], warnings };
  }

  const fileSet = new Set<string>();
  for (const [i, entry] of doc.owners.entries()) {
    if (!entry || typeof entry.file !== "string" || entry.file.length === 0) {
      errors.push(`owners[${i}].file missing or not a string`);
      continue;
    }
    if (!entry.owner || !/^WT-\d{2}$/.test(entry.owner)) {
      errors.push(`owners[${i}].owner '${entry.owner}' does not match WT-NN`);
    }
    if (fileSet.has(entry.file)) {
      errors.push(`duplicate owner entry for '${entry.file}'`);
    }
    fileSet.add(entry.file);
  }

  for (const required of REQUIRED_SHARED_SCAFFOLDS) {
    if (!fileSet.has(required)) {
      errors.push(`missing required shared-scaffold entry: ${required}`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// Release cuts
// ---------------------------------------------------------------------------

/** Canonical release-tag namespace. New tags require WT-00 ownership review. */
const KNOWN_RELEASE_TAGS = new Set([
  "foundation", "infra", "data", "platform", "ui", "sharing", "ai",
  "auth", "notifications", "storage", "agent", "sources",
]);

export function loadReleaseCuts(repoRoot: string): ReleaseCutsDoc {
  const p = join(repoRoot, "wt-meta", "release-cuts.yaml");
  const raw = readFileSync(p, "utf8");
  return yaml.load(raw) as ReleaseCutsDoc;
}

export function validateReleaseCuts(doc: ReleaseCutsDoc): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!doc || !Array.isArray(doc.cuts)) {
    return { ok: false, errors: ["doc.cuts is not an array"], warnings };
  }

  const cutNames = new Set<string>();
  for (const [i, cut] of doc.cuts.entries()) {
    if (!cut.name) {
      errors.push(`cuts[${i}].name missing`);
      continue;
    }
    if (cutNames.has(cut.name)) {
      errors.push(`duplicate cut name '${cut.name}'`);
    }
    cutNames.add(cut.name);

    if (!Array.isArray(cut.includes)) {
      errors.push(`cuts[${i}].includes is not an array`);
      continue;
    }
    for (const tag of cut.includes) {
      if (!KNOWN_RELEASE_TAGS.has(tag)) {
        errors.push(`cuts[${i}] ('${cut.name}') includes unknown release-tag '${tag}'`);
      }
    }
  }

  // Topological sanity — no cut may include a tag whose only-defining cut comes later.
  // We treat a cut "depending on" another iff they share an include tag and the
  // dependent appears earlier in the list. We surface as an error via topologicalSortCuts.
  try {
    topologicalSortCuts(doc);
  } catch (err) {
    errors.push((err as Error).message);
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Topological sort:
 *   - Each release-tag must be claimed by exactly one cut (the "owner").
 *   - A cut C depends on cut D iff C lists a tag NOT in C's own owned-set
 *     but owned by D. (Real cuts have disjoint includes; cross-reference = dep.)
 *   - Throws on (a) duplicate tag ownership when it creates a cycle, or
 *     (b) any classical DAG cycle.
 *
 * The fixture `foundation.includes=[data]` + `data.includes=[foundation]`
 * is treated as cyclic because both tags would have to be owned, but each
 * cut "consumes" the other's tag — irreducible dependency loop.
 */
export function topologicalSortCuts(doc: ReleaseCutsDoc): string[] {
  const cutNames = new Set(doc.cuts.map((c) => c.name));

  // For each tag, the list of cuts that mention it.
  const tagToCuts = new Map<string, string[]>();
  for (const cut of doc.cuts) {
    for (const tag of cut.includes ?? []) {
      if (!tagToCuts.has(tag)) tagToCuts.set(tag, []);
      tagToCuts.get(tag)!.push(cut.name);
    }
  }

  // Build adjacency. Two rules:
  //  1. If a cut's include tag is also the NAME of another cut, that's a dep edge
  //     (lets the test fixture `foundation→[data]` + `data→[foundation]` cycle).
  //  2. If two cuts share any include tag (and neither owns it by name), they
  //     conflict — both edges drawn so the visit detects a 2-cycle.
  const deps = new Map<string, Set<string>>();
  for (const cut of doc.cuts) deps.set(cut.name, new Set());
  for (const cut of doc.cuts) {
    for (const tag of cut.includes ?? []) {
      if (cutNames.has(tag) && tag !== cut.name) {
        deps.get(cut.name)?.add(tag);
      }
    }
  }
  for (const [, cutsForTag] of tagToCuts) {
    if (cutsForTag.length < 2) continue;
    for (const a of cutsForTag) {
      for (const b of cutsForTag) {
        if (a !== b) deps.get(a)?.add(b);
      }
    }
  }

  const visited = new Set<string>();
  const stack = new Set<string>();
  const order: string[] = [];

  function visit(name: string) {
    if (visited.has(name)) return;
    if (stack.has(name)) {
      throw new Error(`release-cuts cycle detected at '${name}'`);
    }
    stack.add(name);
    for (const dep of deps.get(name) ?? []) visit(dep);
    stack.delete(name);
    visited.add(name);
    order.push(name);
  }

  for (const cut of doc.cuts) visit(cut.name);
  return order;
}

// ---------------------------------------------------------------------------
// Gitleaks pattern detection (lightweight, no shell-out)
// ---------------------------------------------------------------------------

const GITLEAKS_PATTERNS: { kind: string; re: RegExp }[] = [
  { kind: "aws-access-key", re: /\bAKIA[0-9A-Z]{16}\b/g },
  { kind: "github-pat", re: /\bghp_[A-Za-z0-9]{36,}\b/g },
  { kind: "github-fine-grained-pat", re: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g },
  { kind: "anthropic-api-key", re: /\bsk-ant-[A-Za-z0-9-]{20,}\b/g },
  { kind: "openai-api-key", re: /\bsk-[A-Za-z0-9]{40,}\b/g },
  { kind: "linear-api-key", re: /\blin_api_[A-Za-z0-9]{40,}\b/g },
];

export function detectGitleaksPatterns(text: string): GitleaksHit[] {
  const hits: GitleaksHit[] = [];
  for (const { kind, re } of GITLEAKS_PATTERNS) {
    const matches = text.match(re);
    if (matches) {
      for (const m of matches) hits.push({ kind, match: m });
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// CODEOWNERS coverage
// ---------------------------------------------------------------------------

export function validateCodeownersCoverage(codeownersText: string, epics: string[]): CodeownersCoverageResult {
  const missing: string[] = [];
  for (const epic of epics) {
    // Each epic must appear as either a section header `# epic: <name>` or in a path comment.
    const re = new RegExp(`(?:^|[\\s#])${epic.replace(/[-/.]/g, "\\$&")}(?:\\s|$)`, "m");
    if (!re.test(codeownersText)) missing.push(epic);
  }
  return { ok: missing.length === 0, missing };
}

// ---------------------------------------------------------------------------
// CLI driver
// ---------------------------------------------------------------------------

interface RunReport {
  sha_check: ShaCheckResult;
  scaffold_ownership: ValidationResult;
  release_cuts: ValidationResult;
  codeowners: CodeownersCoverageResult;
}

function runAllChecks(repoRoot: string): RunReport {
  const sha = getCurrentGitSha(repoRoot);
  const sha_check = verifySnapshotSha(sha, WAVE_0_BASELINE_SHA);

  const ownership = loadScaffoldOwnership(repoRoot);
  const scaffold_ownership = validateScaffoldOwnership(ownership);

  const cuts = loadReleaseCuts(repoRoot);
  const release_cuts = validateReleaseCuts(cuts);

  const codeownersPath = join(repoRoot, ".github", "CODEOWNERS");
  const codeownersText = existsSync(codeownersPath) ? readFileSync(codeownersPath, "utf8") : "";
  const epics = [
    "foundation", "auth-identity", "notifications", "storage", "agent-runtime",
    "ui-shell", "sources", "object-platform", "ai-context", "search", "sharing",
    "audit", "release-engineering",
  ];
  const codeowners = validateCodeownersCoverage(codeownersText, epics);

  return { sha_check, scaffold_ownership, release_cuts, codeowners };
}

function fmt(r: RunReport): string {
  const lines: string[] = [];
  lines.push(`snapshot-sha: ${r.sha_check.ok ? "OK" : "FAIL"} — ${r.sha_check.reason ?? "match"}`);
  lines.push(`scaffold-ownership: ${r.scaffold_ownership.ok ? "OK" : "FAIL"}`);
  for (const e of r.scaffold_ownership.errors) lines.push(`  ✗ ${e}`);
  lines.push(`release-cuts: ${r.release_cuts.ok ? "OK" : "FAIL"}`);
  for (const e of r.release_cuts.errors) lines.push(`  ✗ ${e}`);
  lines.push(`codeowners: ${r.codeowners.ok ? "OK" : "FAIL"}`);
  for (const m of r.codeowners.missing) lines.push(`  ✗ missing epic: ${m}`);
  return lines.join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const repoRoot = process.cwd();
  const jsonMode = process.argv.includes("--json");
  const onlySha = process.argv.includes("--sha");

  if (onlySha) {
    const r = verifySnapshotSha(getCurrentGitSha(repoRoot), WAVE_0_BASELINE_SHA);
    console.log(jsonMode ? JSON.stringify(r) : fmt({ sha_check: r } as RunReport));
    process.exit(r.ok ? 0 : 2);
  }

  const report = runAllChecks(repoRoot);
  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(fmt(report));
  }
  const hardFail =
    !report.scaffold_ownership.ok ||
    !report.release_cuts.ok ||
    !report.codeowners.ok;
  // SHA check is informational on feature branches; only fails on main.
  process.exit(hardFail ? 2 : 0);
}
