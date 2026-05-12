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
  /**
   * Optional partition of `findings` keyed by probe name. When provided,
   * `<outDir>/per-probe/<probe>.json` is written for each entry per spec § 5.1.
   * Each per-probe artifact uses the same Queue shape as `queue.json` but
   * scoped to a single probe's findings.
   */
  perProbeFindings?: Record<string, Finding[]>;
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

  // Per-probe artifacts (spec § 5.1). Each <outDir>/per-probe/<probe>.json
  // mirrors the queue.json shape but scoped to a single probe's findings.
  if (input.perProbeFindings) {
    const perProbeDir = join(input.outDir, "per-probe");
    mkdirSync(perProbeDir, { recursive: true });
    for (const [probeName, findings] of Object.entries(input.perProbeFindings)) {
      const perProbe = {
        schemaVersion: FINDING_SCHEMA_VERSION,
        runId: input.runId,
        probe: probeName,
        generatedAt: new Date().toISOString(),
        findingCount: findings.length,
        findings,
      };
      atomicWriteJson(join(perProbeDir, `${probeName}.json`), perProbe);
    }
  }

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
