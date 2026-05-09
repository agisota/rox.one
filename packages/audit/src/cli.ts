#!/usr/bin/env bun
import { ProbeRegistry } from "./registry.ts";
import { rank } from "./ranker.ts";
import { writeJsonQueue } from "./reporters/json-queue.ts";
import { writeMarkdownSidecar } from "./reporters/markdown-sidecar.ts";
import { generateTickets } from "./ticket-gen.ts";
import type { Finding, Probe, Surface } from "./probe.ts";
import { staticTscProbe } from "./probes/static-tsc.ts";
import { staticEslintProbe } from "./probes/static-eslint.ts";
import { staticBundleProbe } from "./probes/static-bundle.ts";
import { runtimeAxeProbe } from "./probes/runtime-axe.ts";
import { runtimeStatesProbe } from "./probes/runtime-states.ts";
import { tasteLlmProbe } from "./probes/taste-llm.ts";
import { createPlaywrightRunner } from "./runners/playwright-runner.ts";
import { createLLMRunner, type LLMClient } from "./runners/llm-runner.ts";
import { spawnDevServer, type DevServerHandle } from "./runners/dev-server-runner.ts";
import { join } from "node:path";

const HELP = `Usage:
  audit run <surfaces> [--probes=<csv>] [--worker-cap=N] [--out=<path>] [--no-tickets] [--top-k=N]

  surfaces: comma-separated, one or more of: renderer, webui, viewer, marketing
  --probes: comma-separated probe names (supports * suffix glob)
  --worker-cap: parallel probe-surface pairs (default 4)
  --out: output dir override (default audits/<ISO timestamp>)
  --no-tickets: skip ticket generation in docs/tickets/
  --top-k=N: max tickets to create/update (default 50)

Examples:
  audit run renderer --probes=static-tsc
  audit run renderer,webui,viewer,marketing --probes=static-*
  audit run renderer --no-tickets
  audit run renderer,webui --top-k=20
`;

function parseArgs(argv: string[]): {
  command: "run" | "help";
  surfaces: Surface[];
  probesGlob: string;
  workerCap: number;
  outOverride?: string;
  noTickets: boolean;
  topK: number;
} {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    return { command: "help", surfaces: [], probesGlob: "*", workerCap: 4, noTickets: false, topK: 50 };
  }
  if (args[0] !== "run") {
    return { command: "help", surfaces: [], probesGlob: "*", workerCap: 4, noTickets: false, topK: 50 };
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
  let noTickets = false;
  let topK = 50;
  for (const arg of args.slice(2)) {
    if (arg.startsWith("--probes=")) probesGlob = arg.slice("--probes=".length);
    else if (arg.startsWith("--worker-cap=")) workerCap = Math.max(1, parseInt(arg.slice("--worker-cap=".length), 10) || 4);
    else if (arg.startsWith("--out=")) outOverride = arg.slice("--out=".length);
    else if (arg === "--no-tickets") noTickets = true;
    else if (arg.startsWith("--top-k=")) topK = Math.max(1, parseInt(arg.slice("--top-k=".length), 10) || 50);
  }
  return { command: "run", surfaces, probesGlob, workerCap, outOverride, noTickets, topK };
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
  const probeModules: Probe[] = [staticTscProbe, staticEslintProbe, staticBundleProbe, runtimeAxeProbe, runtimeStatesProbe, tasteLlmProbe];
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

  // Instantiate a shared Playwright runner when any registered probe is A.2+.
  const needsPlaywright = registry.list().some((p) => p.phase !== "A.1");
  const playwright = needsPlaywright ? await createPlaywrightRunner() : undefined;

  // A.3+: instantiate a shared LLM runner when any A.3 probe is selected.
  // Falls back to undefined if ANTHROPIC_API_KEY is not set so the run
  // doesn't crash; the affected probes will return [] in that case.
  const needsLLM = registry.list().some((p) => p.phase === "A.3");
  let llm: LLMClient | undefined;
  if (needsLLM) {
    try {
      llm = createLLMRunner({});
    } catch (e) {
      process.stderr.write(`warning: LLM runner unavailable, A.3 probes will be skipped (${e instanceof Error ? e.message : String(e)})\n`);
    }
  }

  // A.4: when any A.2+ probe is selected, spawn dev servers per surface so
  // runtime probes can crawl the live SPA. Renderer is skipped (Electron app
  // not yet wired) — deferred to A.5.
  // Use process.execPath so the spawned process locates the bun binary even
  // when bun isn't on PATH (e.g. installed under ~/.bun/bin without PATH export).
  const bunBin = process.execPath;
  const devServers = new Map<Surface, DevServerHandle>();
  const surfaceDevCommands: Partial<Record<Surface, { command: string; args: string[] }>> = {
    webui: { command: bunBin, args: ["run", "webui:dev"] },
    viewer: { command: bunBin, args: ["run", "viewer:dev"] },
    marketing: { command: bunBin, args: ["run", "marketing:dev"] },
  };

  try {
    if (needsPlaywright) {
      const crawlable = parsed.surfaces.filter((s) => surfaceDevCommands[s] !== undefined);
      if (crawlable.length > 0) {
        process.stdout.write(`spawning dev servers for: ${crawlable.join(", ")}\n`);
        const handles = await Promise.all(
          crawlable.map(async (surface) => {
            const spec = surfaceDevCommands[surface];
            if (!spec) return null;
            const handle = await spawnDevServer({
              command: spec.command,
              args: spec.args,
              cwd: workspaceRoot,
              readyPattern: /Local:\s+(http:\/\/[^\s]+)/,
              timeoutMs: 45_000,
            });
            return [surface, handle] as const;
          }),
        );
        for (const entry of handles) {
          if (entry) devServers.set(entry[0], entry[1]);
        }
        for (const [surface, handle] of devServers) {
          process.stdout.write(`  ${surface}: ${handle.url}\n`);
        }
      }
    }

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
        playwright,
        devServerUrl: devServers.get(surface)?.url,
        llm,
      }),
    });
    const ranked = rank(result.findings);
    const duration = Date.now() - start;

    // Partition findings by probe for per-probe/<probe>.json artifacts (spec § 5.1).
    // Initialise every registered probe to [] so probes that emitted nothing still
    // produce an artifact — useful for downstream consumers checking probe coverage.
    const perProbeFindings: Record<string, Finding[]> = {};
    for (const probeName of result.runProbes) {
      perProbeFindings[probeName] = [];
    }
    for (const finding of ranked) {
      const bucket = perProbeFindings[finding.probe] ?? (perProbeFindings[finding.probe] = []);
      bucket.push(finding);
    }

    await writeJsonQueue({
      outDir,
      findings: ranked,
      runId,
      probes: result.runProbes,
      surfaces: parsed.surfaces,
      durationMs: duration,
      perProbeFindings,
    });
    await writeMarkdownSidecar({ outDir, runId, findings: ranked });

    if (!parsed.noTickets) {
      const tg = await generateTickets({ repoRoot: workspaceRoot, findings: ranked, topK: parsed.topK });
      process.stdout.write(`tickets: ${tg.created} created, ${tg.updated} updated, ${tg.resolved} resolved\n`);
    }

    process.stdout.write(`audit run complete: ${ranked.length} findings, ${duration}ms\n  ${outDir}/queue.json\n  ${outDir}/queue.md\n`);
    return 0;
  } finally {
    if (playwright) await playwright.close();
    if (llm) await llm.close().catch(() => undefined);
    if (devServers.size > 0) {
      await Promise.all(Array.from(devServers.values()).map((h) => h.kill().catch(() => undefined)));
    }
  }
}

const code = await main();
process.exit(code);
