import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI = join(import.meta.dir, "..", "src", "cli.ts");
const BUN = process.execPath; // resolves to the running bun binary (absolute path)

describe("cli", () => {
  test("`audit --help` prints usage and exits 0", () => {
    const result = spawnSync(BUN, ["run", CLI, "--help"], { encoding: "utf-8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage:");
    expect(result.stdout).toContain("audit run");
  });

  test("`audit run` with no surfaces exits 1 with helpful error", () => {
    const result = spawnSync(BUN, ["run", CLI, "run"], { encoding: "utf-8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("surfaces");
  });

  test("runs static-tsc against a fixture surface and writes valid queue.json", () => {
    const tmp = mkdtempSync(join(tmpdir(), "audit-cli-"));
    try {
      const result = spawnSync(BUN, ["run", CLI, "run", "renderer", "--probes=static-tsc", `--out=${tmp}`, "--no-tickets"], {
        encoding: "utf-8",
        cwd: process.cwd(),
      });
      expect(result.status).toBe(0);
      const queue = JSON.parse(readFileSync(join(tmp, "queue.json"), "utf-8"));
      expect(queue.schemaVersion).toBe(1);
      expect(Array.isArray(queue.findings)).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
