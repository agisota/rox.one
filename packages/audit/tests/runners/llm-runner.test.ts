import { describe, expect, test } from "bun:test";
import Anthropic from "@anthropic-ai/sdk";
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

  test("cost gate throws after maxCalls limit is reached", async () => {
    let callsMade = 0;
    const mockClient = {
      messages: {
        create: async () => {
          callsMade++;
          return {
            content: [{ type: "text", text: "[]" }],
          };
        },
      },
    } as unknown as Anthropic;

    const runner = createLLMRunner({ client: mockClient, maxCalls: 2 });
    const input = { surface: "webui", route: "/", screenshotPng: new Uint8Array() };

    await runner.analyzeScreenshot(input);
    await runner.analyzeScreenshot(input);
    expect(callsMade).toBe(2);

    await expect(runner.analyzeScreenshot(input)).rejects.toThrow(
      "LLM cost gate: exceeded --max-llm-calls=2",
    );
    expect(callsMade).toBe(2);
  });

  test("cost gate default is 100", () => {
    const mockClient = {
      messages: { create: async () => ({ content: [] }) },
    } as unknown as Anthropic;
    const runner = createLLMRunner({ client: mockClient });
    expect(typeof runner.analyzeScreenshot).toBe("function");
  });
});
