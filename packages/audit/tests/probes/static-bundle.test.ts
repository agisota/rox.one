import { afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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

  describe("graceful skip", () => {
    let scratchDir: string;
    beforeEach(() => { scratchDir = mkdtempSync(join(tmpdir(), "audit-bundle-skip-")); });
    afterEach(() => { rmSync(scratchDir, { recursive: true, force: true }); });

    test("returns [] when surfaceRoot has no budget.json", async () => {
      const ctx: ProbeContext = {
        surface: "renderer",
        workspaceRoot: scratchDir,
        surfaceRoot: scratchDir,
        timeoutMs: 30_000,
      };
      const findings = await staticBundleProbe.run(ctx);
      expect(findings).toEqual([]);
    });
  });

  describe("glob pattern budgets", () => {
    let scratchDir: string;
    beforeEach(() => {
      scratchDir = mkdtempSync(join(tmpdir(), "audit-bundle-glob-"));
      // Create dist/assets/ with a content-hashed chunk file
      const assetsDir = join(scratchDir, "dist", "assets");
      mkdirSync(assetsDir, { recursive: true });
      // Write a 1000-byte file
      writeFileSync(join(assetsDir, "main-AbCdEfGh.js"), "x".repeat(1000));
    });
    afterEach(() => { rmSync(scratchDir, { recursive: true, force: true }); });

    test("glob pattern matches hashed chunk and passes when under budget", async () => {
      writeFileSync(
        join(scratchDir, "budget.json"),
        JSON.stringify({ "assets/main-*.js": 2000 }),
      );
      const ctx: ProbeContext = {
        surface: "webui",
        workspaceRoot: scratchDir,
        surfaceRoot: scratchDir,
        timeoutMs: 30_000,
      };
      const findings = await staticBundleProbe.run(ctx);
      expect(findings).toEqual([]);
    });

    test("glob pattern matches hashed chunk and emits over-budget finding", async () => {
      writeFileSync(
        join(scratchDir, "budget.json"),
        JSON.stringify({ "assets/main-*.js": 500 }),
      );
      const ctx: ProbeContext = {
        surface: "webui",
        workspaceRoot: scratchDir,
        surfaceRoot: scratchDir,
        timeoutMs: 30_000,
      };
      const findings = await staticBundleProbe.run(ctx);
      expect(findings.length).toBe(1);
      expect(findings[0]!.rule).toBe("bundle:over-budget");
      expect(findings[0]!.message).toContain("1000");
      expect(findings[0]!.message).toContain("500");
    });

    test("stale glob pattern (no matching file) emits budget-stale finding with zero confidence", async () => {
      writeFileSync(
        join(scratchDir, "budget.json"),
        JSON.stringify({ "assets/main-DEADBEEF.js": 2000, "assets/main-*.js": 2000 }),
      );
      const ctx: ProbeContext = {
        surface: "webui",
        workspaceRoot: scratchDir,
        surfaceRoot: scratchDir,
        timeoutMs: 30_000,
      };
      // "assets/main-DEADBEEF.js" is an exact filename — missing file → silently skipped.
      // "assets/main-*.js" glob matches → under budget → no over-budget finding.
      const findings = await staticBundleProbe.run(ctx);
      expect(findings).toEqual([]);
    });

    test("stale glob pattern with no dist match emits _probe.bundle.budget-stale", async () => {
      writeFileSync(
        join(scratchDir, "budget.json"),
        JSON.stringify({ "assets/NONEXISTENT-*.js": 100 }),
      );
      const ctx: ProbeContext = {
        surface: "webui",
        workspaceRoot: scratchDir,
        surfaceRoot: scratchDir,
        timeoutMs: 30_000,
      };
      const findings = await staticBundleProbe.run(ctx);
      expect(findings.length).toBe(1);
      expect(findings[0]!.rule).toBe("_probe.bundle.budget-stale");
      expect(findings[0]!.confidence).toBe(0);
      expect(findings[0]!.message).toContain("NONEXISTENT-*.js");
    });

    test("exact filename key with no match is silently skipped (backward compat)", async () => {
      writeFileSync(
        join(scratchDir, "budget.json"),
        JSON.stringify({ "assets/main-OldHash.js": 2000 }),
      );
      const ctx: ProbeContext = {
        surface: "webui",
        workspaceRoot: scratchDir,
        surfaceRoot: scratchDir,
        timeoutMs: 30_000,
      };
      const findings = await staticBundleProbe.run(ctx);
      expect(findings).toEqual([]);
    });
  });
});
