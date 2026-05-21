/**
 * master.ts — main CLI orchestrator. Composes all 5 subordinate modules:
 *   - state.ts (load wt-meta)
 *   - linear-sync.ts
 *   - featurebase-sync.ts
 *   - merge-gate.ts
 *   - three-machine-verify.ts
 *   - coordinator.ts
 *
 * Usage:
 *   pnpm tsx scripts/orchestrator/master.ts status            # overview of all WTs
 *   pnpm tsx scripts/orchestrator/master.ts plan <WT-ID>      # role plan for one WT
 *   pnpm tsx scripts/orchestrator/master.ts gate <WT-ID>      # run merge gate (or `all`)
 *   pnpm tsx scripts/orchestrator/master.ts verify <WT-ID>    # 3-machine verify
 *   pnpm tsx scripts/orchestrator/master.ts sync-linear       # push wt-meta → Linear
 *   pnpm tsx scripts/orchestrator/master.ts sync-fb           # push wt-meta → Featurebase
 *   pnpm tsx scripts/orchestrator/master.ts release <cut>     # graduate `<cut>` WTs to main
 *
 * Each subcommand exits with 0 on success, 1 on warnings, 2 on hard failure
 * (consistent with merge-gate convention).
 */

import { loadWTMetas, summarizeState } from "./state.js";
import { syncAll as syncLinear } from "./linear-sync.js";
import { syncAll as syncFB } from "./featurebase-sync.js";
import { runAllGates, runMergeGate } from "./merge-gate.js";
import { verifyAll, verifyWT } from "./three-machine-verify.js";
import { planWT, loadState } from "./coordinator.js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

const COMMANDS = [
  "status", "plan", "gate", "verify",
  "sync-linear", "sync-fb",
  "release", "help",
] as const;
type Command = typeof COMMANDS[number];

function usage(): string {
  return [
    "master.ts — ROX.ONE WT-harness orchestrator",
    "",
    "Commands:",
    "  status                       — overview of all 59 WTs",
    "  plan <WT-ID>                 — print 5-phase × 22-role plan for one WT",
    "  gate <WT-ID|all>             — run merge gate (typecheck/lint/tests/evidence)",
    "  verify <WT-ID|all>           — trigger 3-machine GH Actions + collect evidence",
    "  sync-linear [--dry-run]      — push wt-meta → Linear epics + child stories",
    "  sync-fb [--dry-run]          — push wt-meta → Featurebase posts",
    "  release <cut>                — list WTs ready for a release cut",
    "  help                         — this message",
    "",
    "Env: LINEAR_API_KEY, FEATUREBASE_API_KEY, GH_TOKEN (per command needed)",
  ].join("\n");
}

interface ReleaseCutsConfig {
  cuts: Array<{
    name: string;
    description: string;
    includes: string[];
    excludes: string[];
    target_date: string;
  }>;
}

function loadReleaseCuts(): ReleaseCutsConfig | null {
  const file = join(process.cwd(), "wt-meta", "release-cuts.yaml");
  if (!existsSync(file)) return null;
  try {
    return parseYaml(readFileSync(file, "utf8")) as ReleaseCutsConfig;
  } catch (err) {
    console.error(`release-cuts.yaml parse failed: ${(err as Error).message}`);
    return null;
  }
}

async function cmdStatus(): Promise<number> {
  const wts = await loadWTMetas();
  const summary = summarizeState(wts);
  console.log(`# ROX.ONE WT Harness — ${wts.length} WTs total`);
  console.log("");
  console.log(`## By wave`);
  for (const [wave, ids] of Object.entries(summary.byWave)) {
    console.log(`  Wave ${wave}: ${ids.length} WTs — ${ids.join(", ")}`);
  }
  console.log("");
  console.log(`## By priority`);
  for (const [pri, ids] of Object.entries(summary.byPriority)) {
    console.log(`  ${pri}: ${ids.length} WTs`);
  }
  console.log("");
  console.log(`## Coordinator state`);
  for (const wt of wts) {
    const state = loadState(wt.id);
    const phase = state?.currentPhase ?? "(not started)";
    console.log(`  [${wt.id}] ${phase}`);
  }
  return 0;
}

async function cmdPlan(wtId: string): Promise<number> {
  const wts = await loadWTMetas();
  const wt = wts.find((w) => w.id === wtId);
  if (!wt) {
    console.error(`WT ${wtId} not found`);
    return 2;
  }
  console.log(planWT(wt));
  return 0;
}

async function cmdGate(arg: string): Promise<number> {
  if (arg === "all") {
    const reports = await runAllGates();
    const blocked = reports.filter((r) => r.decision === "NO-GO").length;
    const warned = reports.filter((r) => r.decision === "GO-WITH-WARNINGS").length;
    const green = reports.filter((r) => r.decision === "GO").length;
    console.log(`\n=== Merge gate: ${green} GO / ${warned} warn / ${blocked} NO-GO ===`);
    return blocked > 0 ? 2 : warned > 0 ? 1 : 0;
  }
  const wts = await loadWTMetas();
  const wt = wts.find((w) => w.id === arg);
  if (!wt) {
    console.error(`WT ${arg} not found`);
    return 2;
  }
  const r = await runMergeGate(wt);
  console.log(JSON.stringify(r, null, 2));
  return r.decision === "NO-GO" ? 2 : r.decision === "GO-WITH-WARNINGS" ? 1 : 0;
}

async function cmdVerify(arg: string): Promise<number> {
  if (arg === "all") {
    const reports = await verifyAll();
    const failed = reports.filter((r) => r.conclusion !== "success").length;
    console.log(`\n=== 3-machine verify: ${reports.length - failed}/${reports.length} success ===`);
    return failed > 0 ? 2 : 0;
  }
  const wts = await loadWTMetas();
  const wt = wts.find((w) => w.id === arg);
  if (!wt) {
    console.error(`WT ${arg} not found`);
    return 2;
  }
  const r = await verifyWT(wt);
  console.log(JSON.stringify(r, null, 2));
  return r.conclusion === "success" && r.machines.every((m) => m.evidencePresent) ? 0 : 2;
}

async function cmdSyncLinear(dryRun: boolean): Promise<number> {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    console.error("LINEAR_API_KEY env required");
    return 2;
  }
  const teamId = process.env.LINEAR_TEAM_ID ?? "86e0ae89-3cf0-43b7-b363-0433b9f47319";
  const reports = await syncLinear({ apiKey, teamId, dryRun });
  const errors = reports.reduce((a, r) => a + r.errors.length, 0);
  const created = reports.reduce((a, r) => a + r.childrenCreated, 0);
  const existing = reports.reduce((a, r) => a + r.childrenExisting, 0);
  console.log(`\n=== Linear sync: +${created} created / =${existing} existing / !${errors} errors ===`);
  return errors > 0 ? 2 : 0;
}

async function cmdSyncFB(dryRun: boolean): Promise<number> {
  const apiKey = process.env.FEATUREBASE_API_KEY;
  if (!apiKey) {
    console.error("FEATUREBASE_API_KEY env required");
    return 2;
  }
  const reports = await syncFB({ apiKey, dryRun });
  const errors = reports.filter((r) => r.error).length;
  const created = reports.filter((r) => r.action === "created").length;
  const found = reports.filter((r) => r.action === "found").length;
  console.log(`\n=== FB sync: +${created} created / =${found} existing / !${errors} errors ===`);
  return errors > 0 ? 2 : 0;
}

async function cmdRelease(cut: string): Promise<number> {
  const cfg = loadReleaseCuts();
  if (!cfg) {
    console.error("wt-meta/release-cuts.yaml missing or invalid");
    return 2;
  }
  const found = cfg.cuts.find((c) => c.name === cut);
  if (!found) {
    console.error(`Cut "${cut}" not defined. Available: ${cfg.cuts.map((c) => c.name).join(", ")}`);
    return 2;
  }
  const wts = await loadWTMetas();
  const eligible = wts.filter((wt) => {
    const flagCut = (wt.feature_flag as { release_cut?: string }).release_cut;
    if (!flagCut) return false;
    if (found.includes.includes(flagCut)) return !found.excludes.includes(wt.id);
    return false;
  });

  console.log(`# Release cut: ${cut} (target ${found.target_date})`);
  console.log(`# ${found.description}`);
  console.log("");
  console.log(`Eligible WTs (${eligible.length}):`);
  for (const wt of eligible) {
    console.log(`  [${wt.id}] ${wt.title} (wave ${wt.wave}, ${wt.priority})`);
  }
  return 0;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const cmd = (args[0] ?? "help") as Command | string;
  const target = args[1];
  const dryRun = args.includes("--dry-run");

  if (!COMMANDS.includes(cmd as Command) || cmd === "help") {
    console.log(usage());
    return cmd === "help" ? 0 : 1;
  }

  switch (cmd as Command) {
    case "status":      return cmdStatus();
    case "plan":        return target ? cmdPlan(target) : (console.error("plan requires <WT-ID>"), 2);
    case "gate":        return cmdGate(target ?? "all");
    case "verify":      return cmdVerify(target ?? "all");
    case "sync-linear": return cmdSyncLinear(dryRun);
    case "sync-fb":     return cmdSyncFB(dryRun);
    case "release":     return target ? cmdRelease(target) : (console.error("release requires <cut>"), 2);
    case "help":        console.log(usage()); return 0;
  }
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error("master fatal:", err);
      process.exit(2);
    });
}
