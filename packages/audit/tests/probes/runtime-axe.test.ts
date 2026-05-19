import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { runtimeAxeProbe } from "../../src/probes/runtime-axe.ts";
import { createPlaywrightRunner } from "../../src/runners/playwright-runner.ts";
import type { ProbeContext } from "../../src/probe.ts";

const FIXTURE = join(import.meta.dir, "..", "fixtures", "axe-broken");

describe("runtime-axe probe", () => {
  test("metadata", () => {
    expect(runtimeAxeProbe.name).toBe("runtime-axe");
    expect(runtimeAxeProbe.phase).toBe("A.2");
    expect(runtimeAxeProbe.applicableTo("renderer")).toBe(true);
  });

  test("detects WCAG violations on fixture page", async () => {
    const playwright = await createPlaywrightRunner();
    const ctx: ProbeContext = {
      surface: "viewer",
      workspaceRoot: FIXTURE,
      surfaceRoot: FIXTURE,
      playwright,
      timeoutMs: 60_000,
    };
    try {
      const findings = await runtimeAxeProbe.run(ctx);
      expect(findings.length).toBeGreaterThanOrEqual(2);
      const rules = findings.map((f) => f.rule);
      expect(rules.some((r) => r.startsWith("axe:"))).toBe(true);
    } finally {
      await playwright.close();
    }
  }, 30_000);
});
