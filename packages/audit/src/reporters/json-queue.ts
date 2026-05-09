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
