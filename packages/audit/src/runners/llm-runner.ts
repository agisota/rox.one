import Anthropic from "@anthropic-ai/sdk";

export interface LLMTasteFinding {
  severity: "critical" | "high" | "medium" | "low";
  rule: string; // e.g. "taste:contrast", "taste:alignment", "taste:hierarchy"
  message: string;
  suggestedFix?: string;
  selector?: string; // CSS selector if Sonnet identifies a specific element
}

export interface AnalyzeInput {
  surface: string;
  route: string;
  screenshotPng: Uint8Array;
}

export interface AnalyzeOutput {
  findings: LLMTasteFinding[];
}

export interface LLMClient {
  analyzeScreenshot(input: AnalyzeInput): Promise<AnalyzeOutput>;
  close(): Promise<void>;
}

const SYSTEM_PROMPT = `You are a senior UI/UX designer auditing a web interface for taste defects that automated tools miss.

Look at the screenshot and identify visual issues in these categories:
- alignment: misaligned elements, inconsistent spacing
- contrast: insufficient color contrast for readability (beyond axe-core minimums)
- hierarchy: unclear visual hierarchy, weight/size confusion
- typography: poor font choices, inconsistent type scale
- spacing: cramped layouts, awkward whitespace, unbalanced margins
- consistency: inconsistent component variants, mixed paradigms

For each issue, return a JSON object: {"severity": "critical|high|medium|low", "rule": "taste:<category>", "message": "<concise description>", "suggestedFix": "<one-sentence fix>", "selector": "<optional CSS selector>"}.

Return ONLY a JSON array. No prose. If the screenshot looks fine, return [].`;

export interface CreateLLMRunnerInput {
  apiKey?: string; // falls back to ANTHROPIC_API_KEY env var
  model?: string; // default: claude-sonnet-4-6
  maxCalls?: number; // cost gate: max LLM calls before aborting (default 100)
  client?: Anthropic; // DI seam for testing; if unset, instantiated from apiKey
}

export function createLLMRunner(input: CreateLLMRunnerInput = {}): LLMClient {
  const maxCalls = input.maxCalls ?? 100;
  let callCount = 0;

  let client: Anthropic;
  if (input.client) {
    client = input.client;
  } else {
    const apiKey = input.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("LLM runner: ANTHROPIC_API_KEY not set");
    client = new Anthropic({ apiKey });
  }

  const model = input.model ?? "claude-sonnet-4-6";

  return {
    async analyzeScreenshot({ surface, route, screenshotPng }) {
      if (callCount >= maxCalls) {
        throw new Error(
          `LLM cost gate: exceeded --max-llm-calls=${maxCalls}. Increase the cap or scope the run more narrowly.`,
        );
      }
      callCount++;

      const base64 = Buffer.from(screenshotPng).toString("base64");
      const response = await client.messages.create({
        model,
        max_tokens: 2048,
        temperature: 0,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" }, // prompt caching: system prompt cached
          },
        ],
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/png", data: base64 } },
              { type: "text", text: `Surface: ${surface}, Route: ${route}` },
            ],
          },
        ],
      });

      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("\n");

      try {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) return { findings: [] };
        return { findings: parsed as LLMTasteFinding[] };
      } catch {
        return { findings: [] }; // malformed response → empty (safer than crashing)
      }
    },

    async close() {
      // Anthropic SDK doesn't require explicit close
    },
  };
}
