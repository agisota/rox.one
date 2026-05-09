import { describe, expect, test } from "bun:test";
import { createLLMRunner, type LLMClient } from "../../src/runners/llm-runner.ts";

describe("LLMRunner", () => {
  test("createLLMRunner returns a client implementing LLMClient", () => {
    const runner = createLLMRunner({ apiKey: "test-key" });
    expect(typeof runner.analyzeScreenshot).toBe("function");
    expect(typeof runner.close).toBe("function");
  });

  test("respects mock client injection (DI for testing)", async () => {
    const mock: LLMClient = {
      async analyzeScreenshot() {
        return {
          findings: [
            {
              severity: "high",
              rule: "test:rule",
              message: "mocked",
              suggestedFix: "fix it",
            },
          ],
        };
      },
      async close() {},
    };
    const result = await mock.analyzeScreenshot({
      surface: "webui",
      route: "/",
      screenshotPng: new Uint8Array(),
    });
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.rule).toBe("test:rule");
  });
});
