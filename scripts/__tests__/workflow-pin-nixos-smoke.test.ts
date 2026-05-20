import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const repoRoot = join(import.meta.dir, "../..");
const workflowFile = join(repoRoot, ".github/workflows/nixos-smoke.yml");

const SHA40 = /^[0-9a-f]{40}$/;
const USES_PATTERN = /^\s*uses:\s+([^\s#@]+)@([^\s#]+)(\s+#.*)?$/;

describe("nixos-smoke.yml workflow pin policy", () => {
  test("all action refs in nixos-smoke.yml are pinned to 40-char commit SHAs", () => {
    const lines = readFileSync(workflowFile, "utf8").split("\n");
    const offenders: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(USES_PATTERN);
      if (!match) continue;
      const [, target, ref] = match;
      if (target.startsWith("./") || target.startsWith("docker://")) continue;
      if (!SHA40.test(ref)) {
        offenders.push(`line ${i + 1}: ${line.trim()} (ref="${ref}" is not a 40-char SHA)`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
