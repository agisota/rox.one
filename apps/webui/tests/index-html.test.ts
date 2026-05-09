import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const INDEX = join(import.meta.dir, "..", "src", "index.html");

describe("apps/webui index.html", () => {
  test("meta-viewport allows pinch-to-zoom (WCAG 2.2 1.4.4)", () => {
    const html = readFileSync(INDEX, "utf-8");
    expect(html).not.toContain("user-scalable=no");
    expect(html).not.toContain("maximum-scale=1.0");
  });
});
