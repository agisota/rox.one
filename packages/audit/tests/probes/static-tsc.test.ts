import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { staticTscProbe } from "../../src/probes/static-tsc.ts";
import type { ProbeContext } from "../../src/probe.ts";

const FIXTURE_DIR = join(import.meta.dir, "..", "fixtures", "tsc-broken");

describe("static-tsc probe", () => {
  test("name and phase", () => {
    expect(staticTscProbe.name).toBe("static-tsc");
    expect(staticTscProbe.phase).toBe("A.1");
  });

  test("applicableTo returns true for all surfaces", () => {
    expect(staticTscProbe.applicableTo("renderer")).toBe(true);
    expect(staticTscProbe.applicableTo("webui")).toBe(true);
    expect(staticTscProbe.applicableTo("viewer")).toBe(true);
    expect(staticTscProbe.applicableTo("marketing")).toBe(true);
  });

  test("detects all 3 errors in tsc-broken fixture", async () => {
    const ctx: ProbeContext = {
      surface: "renderer",
      workspaceRoot: FIXTURE_DIR,
      surfaceRoot: FIXTURE_DIR,
      timeoutMs: 30_000,
    };
    const findings = await staticTscProbe.run(ctx);
    expect(findings.length).toBeGreaterThanOrEqual(3);
    const codes = findings.map((f) => f.rule);
    expect(codes.some((c) => c.includes("TS2345"))).toBe(true);
    expect(codes.some((c) => c.includes("TS2322"))).toBe(true);
    expect(codes.some((c) => c.includes("TS7006"))).toBe(true);
  });

  test("each finding has stable id, location.file, line", async () => {
    const ctx: ProbeContext = {
      surface: "renderer",
      workspaceRoot: FIXTURE_DIR,
      surfaceRoot: FIXTURE_DIR,
      timeoutMs: 30_000,
    };
    const findings = await staticTscProbe.run(ctx);
    for (const f of findings) {
      expect(f.id).toMatch(/^[0-9a-f]{16}$/);
      expect(f.location.file).toBeTruthy();
      expect(f.location.line).toBeGreaterThan(0);
      expect(f.confidence).toBe(1);
    }
  });

  describe("graceful skip", () => {
    let scratchDir: string;
    beforeEach(() => { scratchDir = mkdtempSync(join(tmpdir(), "audit-tsc-skip-")); });
    afterEach(() => { rmSync(scratchDir, { recursive: true, force: true }); });

    test("returns [] when surfaceRoot has no tsconfig.json", async () => {
      const ctx: ProbeContext = {
        surface: "renderer",
        workspaceRoot: scratchDir,
        surfaceRoot: scratchDir,
        timeoutMs: 30_000,
      };
      const findings = await staticTscProbe.run(ctx);
      expect(findings).toEqual([]);
    });
  });
});
