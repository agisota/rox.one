/**
 * three-machine-verify.ts — triggers 3-machine verification via GitHub Actions
 * + collects evidence per WT.
 *
 * Flow:
 *   1. Trigger workflow `verify-3m.yml` with input `wt=<id>` and `ref=<branch>`.
 *   2. Poll run status until completed (max wait 30min).
 *   3. Download artifacts to `.omc/evidence/<wt>/{mac-14-arm,windows-2022,ubuntu-22}/`.
 *   4. Validate each machine has build.log + smoke-result.json + (optional) screenshots/.
 *
 * Env: GH_TOKEN (required, scopes: actions:write, contents:read).
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadWTMetas, type WTMeta } from "./state.js";

const REPO = process.env.GH_REPO ?? "agisota/rox.one";
const WORKFLOW = process.env.VERIFY_WORKFLOW ?? "verify-3m.yml";
const EVIDENCE_ROOT = join(process.cwd(), ".omc", "evidence");
const POLL_INTERVAL_MS = 15_000;
const MAX_WAIT_MS = 30 * 60 * 1000;

export interface VerifyReport {
  wtId: string;
  runId: number | null;
  conclusion: "success" | "failure" | "cancelled" | "timed_out" | "pending" | "not-triggered";
  machines: { name: string; evidencePresent: boolean; missing: string[] }[];
  startedAt: string;
  completedAt: string | null;
}

interface GhRun {
  databaseId: number;
  status: string;
  conclusion: string | null;
  headBranch: string;
  createdAt: string;
}

function gh(args: string[]): { ok: boolean; output: string } {
  try {
    const output = execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, output };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return { ok: false, output: (e.stdout ?? "") + (e.stderr ?? "") + (e.message ?? "") };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function triggerWorkflow(wt: WTMeta): { ok: boolean; output: string } {
  return gh([
    "workflow", "run", WORKFLOW,
    "-R", REPO,
    "--ref", wt.branch,
    "-f", `wt=${wt.id}`,
    "-f", `ref=${wt.branch}`,
  ]);
}

export function findLatestRun(branch: string): GhRun | null {
  const res = gh([
    "run", "list",
    "-R", REPO,
    "-w", WORKFLOW,
    "-b", branch,
    "--json", "databaseId,status,conclusion,headBranch,createdAt",
    "-L", "1",
  ]);
  if (!res.ok) return null;
  try {
    const runs = JSON.parse(res.output) as GhRun[];
    return runs[0] ?? null;
  } catch {
    return null;
  }
}

export async function pollUntilComplete(runId: number, maxWaitMs = MAX_WAIT_MS): Promise<GhRun | null> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const res = gh([
      "run", "view", String(runId),
      "-R", REPO,
      "--json", "databaseId,status,conclusion,headBranch,createdAt",
    ]);
    if (res.ok) {
      try {
        const run = JSON.parse(res.output) as GhRun;
        if (run.status === "completed") return run;
      } catch {
        // ignore parse error, retry
      }
    }
    await sleep(POLL_INTERVAL_MS);
  }
  return null;
}

export function downloadArtifacts(runId: number, wtId: string): { ok: boolean; output: string } {
  const target = join(EVIDENCE_ROOT, wtId.toLowerCase());
  mkdirSync(target, { recursive: true });
  return gh(["run", "download", String(runId), "-R", REPO, "-D", target]);
}

export function validateEvidence(wt: WTMeta): VerifyReport["machines"] {
  const target = join(EVIDENCE_ROOT, wt.id.toLowerCase());
  const machines = wt.verification?.machines ?? ["mac-14-arm", "windows-2022", "ubuntu-22"];
  const result: VerifyReport["machines"] = [];
  for (const machine of machines) {
    const dir = join(target, machine);
    if (!existsSync(dir)) {
      result.push({ name: machine, evidencePresent: false, missing: ["<entire dir>"] });
      continue;
    }
    const required = ["build.log", "smoke-result.json"];
    if (wt.verification?.screenshots_required) required.push("screenshots");
    const missing = required.filter((f) => !existsSync(join(dir, f)));
    result.push({ name: machine, evidencePresent: missing.length === 0, missing });
  }
  return result;
}

export async function verifyWT(wt: WTMeta): Promise<VerifyReport> {
  const startedAt = new Date().toISOString();
  const report: VerifyReport = {
    wtId: wt.id,
    runId: null,
    conclusion: "not-triggered",
    machines: [],
    startedAt,
    completedAt: null,
  };

  const triggered = triggerWorkflow(wt);
  if (!triggered.ok) {
    report.conclusion = "not-triggered";
    return report;
  }
  await sleep(5000); // give GitHub time to register the run
  const run = findLatestRun(wt.branch);
  if (!run) {
    report.conclusion = "not-triggered";
    return report;
  }
  report.runId = run.databaseId;
  report.conclusion = "pending";

  const final = await pollUntilComplete(run.databaseId);
  if (!final) {
    report.conclusion = "timed_out";
    return report;
  }
  report.completedAt = new Date().toISOString();
  report.conclusion = (final.conclusion ?? "failure") as VerifyReport["conclusion"];

  if (report.conclusion === "success") {
    downloadArtifacts(run.databaseId, wt.id);
  }
  report.machines = validateEvidence(wt);
  return report;
}

export function readEvidenceJson(wtId: string, machine: string): unknown | null {
  const file = join(EVIDENCE_ROOT, wtId.toLowerCase(), machine, "smoke-result.json");
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as unknown;
  } catch {
    return null;
  }
}

export async function verifyAll(): Promise<VerifyReport[]> {
  const wts = await loadWTMetas();
  const reports: VerifyReport[] = [];
  for (const wt of wts) {
    const r = await verifyWT(wt);
    reports.push(r);
    const allMachinesOk = r.machines.every((m) => m.evidencePresent);
    console.log(`  [${wt.id}] ${r.conclusion} evidence=${allMachinesOk ? "ok" : "incomplete"} run=${r.runId ?? "—"}`);
  }
  return reports;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const wtId = process.argv.find((a) => a.startsWith("--wt="))?.split("=")[1];
  (async () => {
    if (wtId) {
      const wts = await loadWTMetas();
      const wt = wts.find((w) => w.id === wtId);
      if (!wt) {
        console.error(`WT ${wtId} not found`);
        process.exit(2);
      }
      const r = await verifyWT(wt);
      console.log(JSON.stringify(r, null, 2));
      process.exit(r.conclusion === "success" && r.machines.every((m) => m.evidencePresent) ? 0 : 2);
    } else {
      const reports = await verifyAll();
      const failed = reports.filter((r) => r.conclusion !== "success").length;
      console.log(`\n=== 3-machine verify: ${reports.length - failed}/${reports.length} success ===`);
      process.exit(failed > 0 ? 2 : 0);
    }
  })().catch((err) => {
    console.error("three-machine-verify fatal:", err);
    process.exit(2);
  });
}
