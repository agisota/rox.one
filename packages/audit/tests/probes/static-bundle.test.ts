import { describe, expect, test, beforeAll } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { staticBundleProbe } from "../../src/probes/static-bundle.ts";
import type { ProbeContext } from "../../src/probe.ts";

const FIXTURE_DIR = join(import.meta.dir, "..", "fixtures", "bundle-bloated");

beforeAll(() => {
  // Build the fixture dist/main.js using the same bun binary running this process
  const result = spawnSync(process.execPath, ["run", "build-fixture.ts"], {
    cwd: FIXTURE_DIR,
    encoding: "utf-8",
    timeout: 30_000,
  });
  if (result.status !== 0) {
    throw new Error(`build-fixture.ts failed: ${result.stderr}`);
  }
});

describe("static-bundle probe", () => {
  test("metadata", () => {
    expect(staticBundleProbe.name).toBe("static-bundle");
    expect(staticBundleProbe.phase).toBe("A.1");
    expect(staticBundleProbe.applicableTo("renderer")).toBe(true);
    expect(staticBundleProbe.applicableTo("webui")).toBe(true);
  });

  test("emits finding when bundle exceeds budget", async () => {
    const ctx: ProbeContext = {
      surface: "renderer",
      workspaceRoot: FIXTURE_DIR,
      surfaceRoot: FIXTURE_DIR,
      timeoutMs: 30_000,
    };
    const findings = await staticBundleProbe.run(ctx);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    const f = findings[0]!;
    expect(f.rule).toBe("bundle:over-budget");
    expect(f.severity).toBe("high");
    expect(f.confidence).toBe(1);
    expect(f.probe).toBe("static-bundle");
    expect(f.id).toMatch(/^[0-9a-f]{16}$/);
    expect(f.message).toContain("main.js");
    expect(f.message).toContain("200000");
  });

  test("returns no findings when bundle under budget", async () => {
    const ctx: ProbeContext = {
      surface: "renderer",
      workspaceRoot: FIXTURE_DIR,
      surfaceRoot: FIXTURE_DIR,
      // Override dist root to a directory without oversized files
      buildOutputRoot: join(FIXTURE_DIR, "nonexistent-dist"),
      timeoutMs: 30_000,
    };
    const findings = await staticBundleProbe.run(ctx);
    expect(findings.length).toBe(0);
  });
});
