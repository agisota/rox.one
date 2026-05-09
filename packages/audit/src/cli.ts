#!/usr/bin/env bun
import { ProbeRegistry } from "./registry.ts";
import { rank } from "./ranker.ts";
import { writeJsonQueue } from "./reporters/json-queue.ts";
import { writeMarkdownSidecar } from "./reporters/markdown-sidecar.ts";
import type { Probe, Surface } from "./probe.ts";
import { staticTscProbe } from "./probes/static-tsc.ts";
import { staticEslintProbe } from "./probes/static-eslint.ts";
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
  const probeModules: Probe[] = [staticTscProbe, staticEslintProbe];
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
