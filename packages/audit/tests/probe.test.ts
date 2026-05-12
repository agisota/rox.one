import { describe, expect, test } from "bun:test";
import { computeFindingId, type Finding } from "../src/probe.ts";

describe("computeFindingId", () => {
  test("same probe + location + rule → same id across calls", () => {
    const a = computeFindingId({ probe: "static-tsc", rule: "TS2345", file: "x.ts", line: 10 });
    const b = computeFindingId({ probe: "static-tsc", rule: "TS2345", file: "x.ts", line: 10 });
    expect(a).toBe(b);
  });

  test("different rule → different id", () => {
    const a = computeFindingId({ probe: "static-tsc", rule: "TS2345", file: "x.ts", line: 10 });
    const b = computeFindingId({ probe: "static-tsc", rule: "TS2322", file: "x.ts", line: 10 });
    expect(a).not.toBe(b);
  });

  test("different file → different id", () => {
    const a = computeFindingId({ probe: "static-tsc", rule: "TS2345", file: "x.ts", line: 10 });
    const b = computeFindingId({ probe: "static-tsc", rule: "TS2345", file: "y.ts", line: 10 });
    expect(a).not.toBe(b);
  });

  test("id is 16 hex chars (truncated SHA-256)", () => {
    const id = computeFindingId({ probe: "static-tsc", rule: "TS2345", file: "x.ts", line: 10 });
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("Finding shape", () => {
  test("Finding can be constructed with all required fields", () => {
    const f: Finding = {
      schemaVersion: 1,
      id: "abcd1234abcd1234",
      probe: "static-tsc",
      surface: "renderer",
      phase: "A.1",
      severity: "high",
      rule: "TS2345",
      location: { file: "src/foo.ts", line: 10 },
      message: "Argument of type X is not assignable to Y",
      confidence: 1,
      vdiImpact: { quality: 0.7, risk: 0.3, readiness: 0.5 },
      firstSeen: "2026-05-09T11:00:00Z",
      lastSeen: "2026-05-09T11:00:00Z",
    };
    expect(f.schemaVersion).toBe(1);
    expect(f.surface).toBe("renderer");
  });
});
