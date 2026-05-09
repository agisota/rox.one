import { describe, expect, test } from "bun:test";
import { tasteLlmProbe } from "../../src/probes/taste-llm.ts";
import type { LLMClient } from "../../src/runners/llm-runner.ts";
import type { ProbeContext } from "../../src/probe.ts";
import type { PlaywrightRunner } from "../../src/runners/playwright-runner.ts";

const mockPlaywright: PlaywrightRunner = {
  async newPage() {
    return {
      async goto() {},
      async screenshot() {
        return Buffer.from("fake-png-bytes");
      },
      async close() {},
    } as never;
  },
  async close() {},
};

const mockLLM: LLMClient = {
  async analyzeScreenshot() {
    return {
      findings: [
        {
          severity: "medium" as const,
          rule: "taste:contrast",
          message: "Insufficient contrast on body text",
          suggestedFix: "Use #333 instead of #999",
        },
      ],
    };
  },
  async close() {},
};

describe("taste-llm probe", () => {
  test("metadata", () => {
    expect(tasteLlmProbe.name).toBe("taste-llm");
    expect(tasteLlmProbe.phase).toBe("A.3");
    expect(tasteLlmProbe.applicableTo("renderer")).toBe(true);
    expect(tasteLlmProbe.applicableTo("webui")).toBe(true);
  });

  test("returns [] when no LLM client provided", async () => {
    const ctx = {
      surface: "webui" as const,
      workspaceRoot: "/tmp",
      surfaceRoot: "/tmp",
      timeoutMs: 60_000,
      playwright: mockPlaywright,
      // no llm
    } as ProbeContext;
    const result = await tasteLlmProbe.run(ctx);
    expect(result).toEqual([]);
  });

  test("returns [] when no playwright provided (cannot screenshot)", async () => {
    const ctx = {
      surface: "webui" as const,
      workspaceRoot: "/tmp",
      surfaceRoot: "/tmp",
      timeoutMs: 60_000,
      llm: mockLLM,
      // no playwright
    } as ProbeContext;
    const result = await tasteLlmProbe.run(ctx);
    expect(result).toEqual([]);
  });

  test("returns [] when discoverRoutes finds no routes (no dev server, no /src/pages)", async () => {
    // With no devServerUrl and a surfaceRoot lacking /src/pages, file-based
    // discovery returns []. The probe short-circuits to [] without calling
    // the LLM. This verifies the integration of route discovery with the
    // probe's early-exit guard rather than mocking discovery itself.
    const ctx = {
      surface: "webui" as const,
      workspaceRoot: "/tmp",
      surfaceRoot: "/tmp/__no_pages_dir__",
      timeoutMs: 60_000,
      playwright: mockPlaywright,
      llm: mockLLM,
    } as ProbeContext;
    const result = await tasteLlmProbe.run(ctx);
    expect(result).toEqual([]);
  });
});
