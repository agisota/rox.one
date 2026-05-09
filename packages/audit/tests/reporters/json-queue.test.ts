import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeJsonQueue } from "../../src/reporters/json-queue.ts";
import type { Finding } from "../../src/probe.ts";

let dir: string;

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "audit-test-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const f: Finding = {
  schemaVersion: 1,
  id: "1111111111111111",
  probe: "p",
  surface: "renderer",
  phase: "A.1",
  severity: "high",
  rule: "R",
  location: { file: "x" },
  message: "m",
  confidence: 1,
  vdiImpact: { quality: 0, risk: 0, readiness: 0 },
  firstSeen: "2026-05-09T11:00:00Z",
  lastSeen: "2026-05-09T11:00:00Z",
};

describe("writeJsonQueue", () => {
  test("writes queue.json with all findings", async () => {
    await writeJsonQueue({ outDir: dir, findings: [f], runId: "r1", probes: ["p"], surfaces: ["renderer"], durationMs: 100 });
    const queue = JSON.parse(readFileSync(join(dir, "queue.json"), "utf-8"));
    expect(queue.schemaVersion).toBe(1);
    expect(queue.findings).toHaveLength(1);
  });

  test("manifest.json is written last (after queue.json exists)", async () => {
    await writeJsonQueue({ outDir: dir, findings: [f], runId: "r1", probes: ["p"], surfaces: ["renderer"], durationMs: 100 });
    expect(existsSync(join(dir, "queue.json"))).toBe(true);
    expect(existsSync(join(dir, "manifest.json"))).toBe(true);
    const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf-8"));
    expect(manifest.runId).toBe("r1");
    expect(manifest.status).toBe("ok");
  });

  test("no .tmp files left behind after successful write", async () => {
    await writeJsonQueue({ outDir: dir, findings: [f], runId: "r1", probes: ["p"], surfaces: ["renderer"], durationMs: 100 });
    const tmps = readdirSync(dir).filter((n) => n.endsWith(".tmp"));
    expect(tmps).toEqual([]);
  });
});
