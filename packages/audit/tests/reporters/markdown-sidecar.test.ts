import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeMarkdownSidecar } from "../../src/reporters/markdown-sidecar.ts";
import type { Finding } from "../../src/probe.ts";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "audit-md-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const baseFinding = (overrides: Partial<Finding>): Finding => ({
  schemaVersion: 1,
  id: "0000000000000000",
  probe: "p",
  surface: "renderer",
  phase: "A.1",
  severity: "low",
  rule: "R",
  location: { file: "f" },
  message: "m",
  confidence: 1,
  vdiImpact: { quality: 0, risk: 0, readiness: 0 },
  firstSeen: "2026-05-09T11:00:00Z",
  lastSeen: "2026-05-09T11:00:00Z",
  ...overrides,
});

describe("writeMarkdownSidecar", () => {
  test("groups by severity with critical first", async () => {
    await writeMarkdownSidecar({
      outDir: dir,
      runId: "r1",
      findings: [
        baseFinding({ id: "1111", severity: "low" }),
        baseFinding({ id: "2222", severity: "critical" }),
      ],
    });
    const md = readFileSync(join(dir, "queue.md"), "utf-8");
    const criticalIdx = md.indexOf("## Critical");
    const lowIdx = md.indexOf("## Low");
    expect(criticalIdx).toBeGreaterThanOrEqual(0);
    expect(lowIdx).toBeGreaterThan(criticalIdx);
  });

  test("includes finding count in header", async () => {
    await writeMarkdownSidecar({ outDir: dir, runId: "r1", findings: [baseFinding({ id: "1111" })] });
    const md = readFileSync(join(dir, "queue.md"), "utf-8");
    expect(md).toContain("1 finding");
  });

  test("handles empty findings gracefully", async () => {
    await writeMarkdownSidecar({ outDir: dir, runId: "r1", findings: [] });
    const md = readFileSync(join(dir, "queue.md"), "utf-8");
    expect(md).toContain("0 findings");
    expect(md).toContain("Audit Queue — r1");
  });

  test("escapes backticks in finding messages", async () => {
    await writeMarkdownSidecar({
      outDir: dir,
      runId: "r1",
      findings: [
        baseFinding({ id: "1111", message: "use `foo` not `bar`" }),
      ],
    });
    const md = readFileSync(join(dir, "queue.md"), "utf-8");
    expect(md).toContain("\\`foo\\`");
    expect(md).not.toContain("use `foo`");
  });
});
