import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { runtimeStatesProbe } from "../../src/probes/runtime-states.ts";
import { createPlaywrightRunner } from "../../src/runners/playwright-runner.ts";
import type { ProbeContext } from "../../src/probe.ts";

const FIXTURE = join(import.meta.dir, "..", "fixtures", "states-broken");

describe("runtime-states probe", () => {
  test("metadata", () => {
    expect(runtimeStatesProbe.name).toBe("runtime-states");
    expect(runtimeStatesProbe.phase).toBe("A.2");
    expect(runtimeStatesProbe.applicableTo("renderer")).toBe(true);
  });

  test("detects missing states on fixture page", async () => {
    const playwright = await createPlaywrightRunner();
    const ctx: ProbeContext = {
      surface: "webui",
      workspaceRoot: FIXTURE,
      surfaceRoot: FIXTURE,
      playwright,
      timeoutMs: 60_000,
    };
    try {
      const findings = await runtimeStatesProbe.run(ctx);
      expect(findings.length).toBeGreaterThanOrEqual(1);
      const rules = findings.map((f) => f.rule);
      expect(rules.some((r) => r.startsWith("state:"))).toBe(true);
    } finally {
      await playwright.close();
    }
  }, 30_000);
});
