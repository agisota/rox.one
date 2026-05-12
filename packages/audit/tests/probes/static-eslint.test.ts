import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { staticEslintProbe } from "../../src/probes/static-eslint.ts";
import type { ProbeContext } from "../../src/probe.ts";

const FIXTURE_DIR = join(import.meta.dir, "..", "fixtures", "eslint-broken");

describe("static-eslint probe", () => {
  test("metadata", () => {
    expect(staticEslintProbe.name).toBe("static-eslint");
    expect(staticEslintProbe.phase).toBe("A.1");
    expect(staticEslintProbe.applicableTo("renderer")).toBe(true);
    expect(staticEslintProbe.applicableTo("webui")).toBe(true);
  });

  test("detects fixture violations", async () => {
    const ctx: ProbeContext = {
      surface: "renderer",
      workspaceRoot: FIXTURE_DIR,
      surfaceRoot: FIXTURE_DIR,
      timeoutMs: 30_000,
    };
    const findings = await staticEslintProbe.run(ctx);
    expect(findings.length).toBeGreaterThanOrEqual(2);
    const rules = findings.map((f) => f.rule);
    expect(rules.some((r) => r === "eslint:no-unused-vars")).toBe(true);
    expect(rules.some((r) => r === "eslint:no-console")).toBe(true);
    for (const f of findings) {
      expect(f.id).toMatch(/^[0-9a-f]{16}$/);
      expect(f.confidence).toBe(1);
      expect(f.severity).toBe("high"); // severity 2 → high
      expect(f.probe).toBe("static-eslint");
    }
  });

  describe("graceful skip", () => {
    let scratchDir: string;
    beforeEach(() => { scratchDir = mkdtempSync(join(tmpdir(), "audit-eslint-skip-")); });
    afterEach(() => { rmSync(scratchDir, { recursive: true, force: true }); });

    test("returns [] when surfaceRoot has no eslint config", async () => {
      const ctx: ProbeContext = {
        surface: "renderer",
        workspaceRoot: scratchDir,
        surfaceRoot: scratchDir,
        timeoutMs: 30_000,
      };
      const findings = await staticEslintProbe.run(ctx);
      expect(findings).toEqual([]);
    });
  });
});
