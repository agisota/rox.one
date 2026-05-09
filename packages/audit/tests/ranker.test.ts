import { describe, expect, test } from "bun:test";
import { rank } from "../src/ranker.ts";
import type { Finding } from "../src/probe.ts";

const baseFinding = (overrides: Partial<Finding>): Finding => ({
  schemaVersion: 1,
  id: "0000000000000000",
  probe: "p",
  surface: "renderer",
  phase: "A.1",
  severity: "low",
  rule: "R",
  location: { file: "f" },
  message: "m",
  confidence: 1,
  vdiImpact: { quality: 0, risk: 0, readiness: 0 },
  firstSeen: "2026-05-09T11:00:00Z",
  lastSeen: "2026-05-09T11:00:00Z",
  ...overrides,
});

describe("rank()", () => {
  test("orders by severity descending", () => {
    const findings = [
      baseFinding({ id: "1111111111111111", severity: "low" }),
      baseFinding({ id: "2222222222222222", severity: "critical" }),
      baseFinding({ id: "3333333333333333", severity: "medium" }),
    ];
    const ranked = rank(findings);
    expect(ranked.map((f) => f.severity)).toEqual(["critical", "medium", "low"]);
  });

  test("renderer outranks webui at same severity", () => {
    const findings = [
      baseFinding({ id: "aaaa", surface: "webui", severity: "high" }),
      baseFinding({ id: "bbbb", surface: "renderer", severity: "high" }),
    ];
    const ranked = rank(findings);
    expect(ranked[0]?.surface).toBe("renderer");
  });

  test("zero confidence pushes finding to bottom regardless of severity", () => {
    const findings = [
      baseFinding({ id: "1111", severity: "critical", confidence: 0 }),
      baseFinding({ id: "2222", severity: "low", confidence: 1 }),
    ];
    const ranked = rank(findings);
    expect(ranked[0]?.id).toBe("2222");
  });

  test("ties broken by id ASCII order (stable)", () => {
    const findings = [
      baseFinding({ id: "ffff" }),
      baseFinding({ id: "aaaa" }),
      baseFinding({ id: "cccc" }),
    ];
    const ranked = rank(findings);
    expect(ranked.map((f) => f.id)).toEqual(["aaaa", "cccc", "ffff"]);
  });

  test("identical input produces identical output (determinism)", () => {
    const findings = [
      baseFinding({ id: "1111", severity: "high" }),
      baseFinding({ id: "2222", severity: "medium" }),
      baseFinding({ id: "3333", severity: "high", surface: "webui" }),
    ];
    const a = rank([...findings]);
    const b = rank([...findings]);
    expect(a.map((f) => f.id)).toEqual(b.map((f) => f.id));
  });

  test("appending a low-severity finding does not reorder existing top items", () => {
    const top = [
      baseFinding({ id: "aaaa", severity: "critical" }),
      baseFinding({ id: "bbbb", severity: "high" }),
    ];
    const original = rank(top);
    const extended = rank([...top, baseFinding({ id: "cccc", severity: "low" })]);
    expect(extended.slice(0, 2).map((f) => f.id)).toEqual(original.map((f) => f.id));
  });
});
