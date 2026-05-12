import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const probesDir = join(import.meta.dir, "../src/probes");
const cliPath = join(import.meta.dir, "../src/cli.ts");

function kebabToCamel(s: string): string {
  return s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function probeFiles(): string[] {
  return readdirSync(probesDir).filter(
    (f) => f.endsWith(".ts") && !f.endsWith(".test.ts"),
  );
}

describe("probe registry contract", () => {
  // Guards against adding a new probe file without registering it in cli.ts.
  test("every probe file is registered in cli.ts", () => {
    const cliSource = readFileSync(cliPath, "utf8");
    for (const file of probeFiles()) {
      const base = file.replace(/\.ts$/, "");
      const symbol = `${kebabToCamel(base)}Probe`;
      expect(cliSource, `${file}: symbol "${symbol}" missing from cli.ts`).toContain(symbol);
      expect(cliSource, `${file}: import missing from cli.ts`).toContain(`from "./probes/${file}"`);
    }
  });

  // Guards against a probe importing a sibling probe, which would break phase isolation.
  test("no probe imports from a sibling probe file", () => {
    const importRe = /^\s*import\s+(?:[^"';]+\s+from\s+)?["']([^"']+)["']/gm;
    for (const file of probeFiles()) {
      const source = readFileSync(join(probesDir, file), "utf8");
      let match: RegExpExecArray | null;
      importRe.lastIndex = 0;
      while ((match = importRe.exec(source)) !== null) {
        const path = match[1]!;
        expect(
          /^\.\/[a-z0-9-]+\.ts$/.test(path),
          `${file}: sibling probe import "${path}" breaks phase isolation`,
        ).toBe(false);
      }
    }
  });
});
