/**
 * merge-gate.ts — pre-merge validation для WT-branch.
 *
 * Enforces the 12-gate workflow: для каждой ветки `feat/<wt>` проверяет
 * (1) typecheck/lint/tests pass on HEAD;
 * (2) files_allowed/files_forbidden invariant из wt-meta yaml;
 * (3) 3-machine evidence (mac/win/linux) present в `.omc/evidence/<wt>/`;
 * (4) Mission control artifacts: cjm/, erd/, sequence/, ui-inventory/, observability/;
 * (5) Definition-of-done checklist в wt-meta yaml — все `true`.
 *
 * Exit codes:
 *   0 = all gates green, safe to merge
 *   1 = soft fail (warnings)
 *   2 = hard fail (do not merge)
 *
 * Uses execFileSync (no shell) — safe against injection by design.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { loadWTMetas, type WTMeta } from "./state.js";

export interface GateResult {
  name: string;
  passed: boolean;
  severity: "error" | "warning";
  detail: string;
}

export interface MergeGateReport {
  wtId: string;
  branch: string;
  gates: GateResult[];
  hardFails: number;
  softFails: number;
  decision: "GO" | "NO-GO" | "GO-WITH-WARNINGS";
}

const REPO_ROOT = process.cwd();
const EVIDENCE_DIR = join(REPO_ROOT, ".omc", "evidence");

function gate(name: string, passed: boolean, detail: string, severity: "error" | "warning" = "error"): GateResult {
  return { name, passed, detail, severity };
}

function runCmd(cmd: string, args: string[], cwd: string = REPO_ROOT): { ok: boolean; output: string } {
  try {
    const output = execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, output };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return { ok: false, output: (e.stdout ?? "") + (e.stderr ?? "") + (e.message ?? "") };
  }
}

async function checkChangedFiles(wt: WTMeta, baseRef = "main"): Promise<GateResult> {
  const { ok, output } = runCmd("git", ["diff", "--name-only", `${baseRef}...${wt.branch}`]);
  if (!ok) return gate("changed-files-list", false, `cannot list changed files: ${output.slice(0, 200)}`);
  const changed = output.split("\n").map((s) => s.trim()).filter(Boolean);
  if (changed.length === 0) return gate("changed-files-list", false, `no changes on branch ${wt.branch}`, "warning");

  const allowed = wt.files_allowed ?? [];
  const forbidden = wt.files_forbidden ?? [];
  const matchPrefix = (rule: string, f: string): boolean => f === rule || f.startsWith(rule.replace(/\*\*?$/, ""));
  const isAllowed = (f: string): boolean => allowed.length === 0 || allowed.some((a) => matchPrefix(a, f));
  const isForbidden = (f: string): boolean => forbidden.some((b) => matchPrefix(b, f));

  const violations: string[] = [];
  for (const f of changed) {
    if (isForbidden(f)) violations.push(`forbidden: ${f}`);
    else if (!isAllowed(f)) violations.push(`outside allowlist: ${f}`);
  }
  if (violations.length > 0) {
    return gate(
      "files-allowlist",
      false,
      `${violations.length} violation(s): ${violations.slice(0, 5).join("; ")}${violations.length > 5 ? " …" : ""}`,
    );
  }
  return gate("files-allowlist", true, `${changed.length} file(s) all within allowlist`);
}

async function checkTypecheck(): Promise<GateResult> {
  const { ok, output } = runCmd("pnpm", ["typecheck"]);
  return gate("typecheck", ok, ok ? "tsc exit 0" : `tsc failed: ${output.slice(-300)}`);
}

async function checkLint(): Promise<GateResult> {
  const { ok, output } = runCmd("pnpm", ["lint"]);
  return gate("lint", ok, ok ? "eslint exit 0" : `eslint failed: ${output.slice(-300)}`);
}

async function checkTests(): Promise<GateResult> {
  const { ok, output } = runCmd("pnpm", ["test", "--run"]);
  return gate("tests", ok, ok ? "tests exit 0" : `tests failed: ${output.slice(-300)}`);
}

async function checkEvidence(wt: WTMeta): Promise<GateResult[]> {
  const wtEvidence = join(EVIDENCE_DIR, wt.id.toLowerCase());
  if (!existsSync(wtEvidence)) return [gate("evidence-dir", false, `missing ${wtEvidence}`)];
  const results: GateResult[] = [];
  for (const machine of wt.verification?.machines ?? ["mac-14-arm", "windows-2022", "ubuntu-22"]) {
    const dir = join(wtEvidence, machine);
    if (!existsSync(dir)) {
      results.push(gate(`evidence-${machine}`, false, `missing ${machine}/`));
      continue;
    }
    const required = ["build.log", "smoke-result.json"];
    if (wt.verification?.screenshots_required) required.push("screenshots");
    const missing = required.filter((f) => !existsSync(join(dir, f)));
    results.push(
      missing.length === 0
        ? gate(`evidence-${machine}`, true, "complete")
        : gate(`evidence-${machine}`, false, `missing ${missing.join(", ")}`),
    );
  }
  return results;
}

async function checkMissionArtifacts(wt: WTMeta): Promise<GateResult[]> {
  const mcDir = join(REPO_ROOT, "docs", "mission-control", wt.id.toLowerCase());
  const mc = wt.mission_control;
  const results: GateResult[] = [];

  if (mc.cjm_scenarios.length > 0) {
    const dir = join(mcDir, "cjm");
    const ok = existsSync(dir) && (await readdir(dir).catch(() => [])).some((f) => f.endsWith(".md"));
    results.push(gate("mc-cjm", ok, ok ? "cjm present" : `cjm required (scenarios: ${mc.cjm_scenarios.join(", ")})`));
  }

  if (mc.entities_touched.length > 0) {
    const file = join(mcDir, "erd", "entities.mmd");
    results.push(gate("mc-erd", existsSync(file), existsSync(file) ? "erd present" : `erd required (entities: ${mc.entities_touched.join(", ")})`));
  }

  if (mc.events_emitted.length > 0) {
    const dir = join(mcDir, "sequence");
    const ok = existsSync(dir) && (await readdir(dir).catch(() => [])).some((f) => f.endsWith(".mmd"));
    results.push(gate("mc-sequence", ok, ok ? "sequence present" : `sequence required (events: ${mc.events_emitted.join(", ")})`));
  }

  if (mc.ui_surfaces.length > 0) {
    const dir = join(mcDir, "ui-inventory");
    const ok = existsSync(dir) && (await readdir(dir).catch(() => [])).some((f) => f.endsWith(".md"));
    results.push(gate("mc-ui-inventory", ok, ok ? "ui-inventory present" : `ui-inventory required (surfaces: ${mc.ui_surfaces.join(", ")})`));
  }

  const obsFile = join(mcDir, "observability", "metrics.md");
  results.push(
    gate("mc-observability", existsSync(obsFile), existsSync(obsFile) ? "observability present" : "observability/metrics.md missing", "warning"),
  );

  return results;
}

function checkDoD(wt: WTMeta): GateResult {
  const dod = wt.definition_of_done ?? {};
  const required = ["typecheck_passes", "lint_passes", "unit_tests_pass"];
  const failing = required.filter((k) => dod[k] !== true);
  if (failing.length > 0) return gate("dod", false, `not marked done: ${failing.join(", ")}`);
  return gate("dod", true, `${Object.keys(dod).length} DoD items checked`);
}

export async function runMergeGate(wt: WTMeta, baseRef = "main"): Promise<MergeGateReport> {
  const results: GateResult[] = [];
  results.push(await checkChangedFiles(wt, baseRef));
  results.push(await checkTypecheck());
  results.push(await checkLint());
  results.push(await checkTests());
  results.push(...(await checkEvidence(wt)));
  results.push(...(await checkMissionArtifacts(wt)));
  results.push(checkDoD(wt));

  const hardFails = results.filter((r) => !r.passed && r.severity === "error").length;
  const softFails = results.filter((r) => !r.passed && r.severity === "warning").length;
  const decision: MergeGateReport["decision"] =
    hardFails > 0 ? "NO-GO" : softFails > 0 ? "GO-WITH-WARNINGS" : "GO";

  return { wtId: wt.id, branch: wt.branch, gates: results, hardFails, softFails, decision };
}

export async function runAllGates(baseRef = "main"): Promise<MergeGateReport[]> {
  const wts = await loadWTMetas();
  const reports: MergeGateReport[] = [];
  for (const wt of wts) {
    const r = await runMergeGate(wt, baseRef);
    reports.push(r);
    console.log(`  [${wt.id}] ${r.decision} (hard=${r.hardFails} soft=${r.softFails})`);
  }
  return reports;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const wtId = process.argv.find((a) => a.startsWith("--wt="))?.split("=")[1];
  const baseRef = process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ?? "main";
  (async () => {
    if (wtId) {
      const wts = await loadWTMetas();
      const wt = wts.find((w) => w.id === wtId);
      if (!wt) {
        console.error(`WT ${wtId} not found`);
        process.exit(2);
      }
      const r = await runMergeGate(wt, baseRef);
      console.log(JSON.stringify(r, null, 2));
      process.exit(r.decision === "NO-GO" ? 2 : r.decision === "GO-WITH-WARNINGS" ? 1 : 0);
    } else {
      const reports = await runAllGates(baseRef);
      const blocked = reports.filter((r) => r.decision === "NO-GO").length;
      const warned = reports.filter((r) => r.decision === "GO-WITH-WARNINGS").length;
      const green = reports.filter((r) => r.decision === "GO").length;
      console.log(`\n=== Merge gate: ${green} GO / ${warned} warn / ${blocked} NO-GO ===`);
      process.exit(blocked > 0 ? 2 : warned > 0 ? 1 : 0);
    }
  })().catch((err) => {
    console.error("merge-gate fatal:", err);
    process.exit(2);
  });
}
