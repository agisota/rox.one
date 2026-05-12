import { describe, expect, test } from "bun:test";
import { ProbeRegistry } from "../src/registry.ts";
import type { Finding, Probe, ProbeContext, Surface } from "../src/probe.ts";

function makeProbe(name: string, findings: Finding[]): Probe {
  return {
    name,
    phase: "A.1",
    applicableTo: () => true,
    run: async () => findings,
  };
}

const ctxFor = (surface: Surface): ProbeContext => ({
  surface,
  workspaceRoot: "/tmp/ws",
  surfaceRoot: "/tmp/ws/x",
  timeoutMs: 60_000,
});

describe("ProbeRegistry — basic", () => {
  test("registered probe runs and returns its findings", async () => {
    const reg = new ProbeRegistry();
    const finding: Finding = {
      schemaVersion: 1,
      id: "aaaa1111aaaa1111",
      probe: "p1",
      surface: "renderer",
      phase: "A.1",
      severity: "high",
      rule: "X",
      location: { file: "f" },
      message: "m",
      confidence: 1,
      vdiImpact: { quality: 0, risk: 0, readiness: 0 },
      firstSeen: "2026-05-09T11:00:00Z",
      lastSeen: "2026-05-09T11:00:00Z",
    };
    reg.register(makeProbe("p1", [finding]));
    const result = await reg.run({ surfaces: ["renderer"], probes: ["p1"], workerCap: 1, contextFor: ctxFor });
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.id).toBe("aaaa1111aaaa1111");
  });

  test("filters probes by --probes selection", async () => {
    const reg = new ProbeRegistry();
    reg.register(makeProbe("p1", []));
    reg.register(makeProbe("p2", []));
    const result = await reg.run({ surfaces: ["renderer"], probes: ["p1"], workerCap: 1, contextFor: ctxFor });
    expect(result.runProbes).toEqual(["p1"]);
  });

  test("skips probes whose applicableTo() returns false for the surface", async () => {
    const reg = new ProbeRegistry();
    const onlyRenderer: Probe = {
      name: "only-renderer",
      phase: "A.1",
      applicableTo: (s) => s === "renderer",
      run: async () => [],
    };
    reg.register(onlyRenderer);
    const result = await reg.run({ surfaces: ["webui"], probes: ["only-renderer"], workerCap: 1, contextFor: ctxFor });
    expect(result.executedPairs).toEqual([]);
  });
});

describe("ProbeRegistry — parallelism", () => {
  test("workerCap=1 runs probes serially (proven by overlapping start times being impossible)", async () => {
    const reg = new ProbeRegistry();
    const log: string[] = [];
    const slow = (name: string): Probe => ({
      name,
      phase: "A.1",
      applicableTo: () => true,
      run: async () => {
        log.push(`${name}:start`);
        await new Promise((r) => setTimeout(r, 30));
        log.push(`${name}:end`);
        return [];
      },
    });
    reg.register(slow("p1"));
    reg.register(slow("p2"));
    await reg.run({ surfaces: ["renderer"], probes: ["p1", "p2"], workerCap: 1, contextFor: ctxFor });
    expect(log).toEqual(["p1:start", "p1:end", "p2:start", "p2:end"]);
  });

  test("workerCap=2 runs two probes in parallel (overlapping windows)", async () => {
    const reg = new ProbeRegistry();
    const log: string[] = [];
    const slow = (name: string): Probe => ({
      name,
      phase: "A.1",
      applicableTo: () => true,
      run: async () => {
        log.push(`${name}:start`);
        await new Promise((r) => setTimeout(r, 30));
        log.push(`${name}:end`);
        return [];
      },
    });
    reg.register(slow("p1"));
    reg.register(slow("p2"));
    await reg.run({ surfaces: ["renderer"], probes: ["p1", "p2"], workerCap: 2, contextFor: ctxFor });
    // Both should start before either ends
    const p1StartIdx = log.indexOf("p1:start");
    const p2StartIdx = log.indexOf("p2:start");
    const p1EndIdx = log.indexOf("p1:end");
    expect(p2StartIdx).toBeLessThan(p1EndIdx);
    expect(p1StartIdx).toBeLessThan(p1EndIdx);
  });
});

describe("ProbeRegistry — error handling", () => {
  test("crashed probe emits zero-confidence finding, sibling still runs", async () => {
    const reg = new ProbeRegistry();
    const crasher: Probe = {
      name: "crasher",
      phase: "A.1",
      applicableTo: () => true,
      run: async () => { throw new Error("boom"); },
    };
    const ok: Probe = {
      name: "ok",
      phase: "A.1",
      applicableTo: () => true,
      run: async () => [],
    };
    reg.register(crasher);
    reg.register(ok);
    const result = await reg.run({ surfaces: ["renderer"], probes: ["crasher", "ok"], workerCap: 2, contextFor: ctxFor });
    const crashFinding = result.findings.find((f) => f.rule === "_probe.crash");
    expect(crashFinding).toBeDefined();
    expect(crashFinding?.confidence).toBe(0);
    expect(crashFinding?.message).toContain("boom");
    expect(result.crashed).toHaveLength(1);
  });

  test("probe timeout emits _probe.timeout finding", async () => {
    const reg = new ProbeRegistry();
    const slow: Probe = {
      name: "slow",
      phase: "A.1",
      applicableTo: () => true,
      run: async () => {
        await new Promise((r) => setTimeout(r, 200));
        return [];
      },
    };
    reg.register(slow);
    const result = await reg.run({
      surfaces: ["renderer"],
      probes: ["slow"],
      workerCap: 1,
      contextFor: (s) => ({ ...ctxFor(s), timeoutMs: 50 }),
    });
    const timeoutFinding = result.findings.find((f) => f.rule === "_probe.timeout");
    expect(timeoutFinding).toBeDefined();
    expect(timeoutFinding?.confidence).toBe(0);
  });
});
