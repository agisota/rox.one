import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const repoRoot = join(import.meta.dir, "../..");

describe("roadmap coherence validator", () => {
  test("accepts the current spine, master-roadmap, and rebrand detail files", () => {
    const result = spawnSync("node", ["scripts/validate-roadmap-coherence.cjs"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status, output).toBe(0);
    expect(result.stdout).toContain("validate:roadmap OK");
  });
});
