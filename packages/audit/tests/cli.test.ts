import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
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
});
