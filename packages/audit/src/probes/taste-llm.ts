import { discoverRoutes } from "../discovery.ts";
import type { Finding, FindingSeverity, Probe, ProbeContext } from "../probe.ts";
import { computeFindingId, FINDING_SCHEMA_VERSION } from "../probe.ts";

function severityFromString(s: string): FindingSeverity {
  if (s === "critical" || s === "high" || s === "medium" || s === "low") return s;
  return "medium";
}

export const tasteLlmProbe: Probe = {
  name: "taste-llm",
  phase: "A.3",
  applicableTo: () => true,
  async run(ctx: ProbeContext): Promise<Finding[]> {
    if (!ctx.playwright) return [];
    if (!ctx.llm) return [];

    const routes = await discoverRoutes(ctx.surface, ctx.surfaceRoot, ctx.devServerUrl, ctx.playwright);
    if (routes.length === 0) return [];

    const findings: Finding[] = [];
    const now = new Date().toISOString();

    for (const route of routes) {
      const url = ctx.devServerUrl
        ? new URL(route, ctx.devServerUrl).toString()
        : `file://${ctx.surfaceRoot}/src/pages${route === "/" ? "/index" : route}.html`;
      const page = await ctx.playwright.newPage();
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
        const screenshotPng = await page.screenshot({ fullPage: true, type: "png" });
        const result = await ctx.llm.analyzeScreenshot({
          surface: ctx.surface,
          route,
          screenshotPng,
        });
        for (const f of result.findings) {
          const id = computeFindingId({
            probe: "taste-llm",
            rule: f.rule,
            file: url,
            line: 0,
          });
          findings.push({
            schemaVersion: FINDING_SCHEMA_VERSION,
            id,
            probe: "taste-llm",
            surface: ctx.surface,
            phase: "A.3",
            severity: severityFromString(f.severity),
            rule: f.rule,
            location: { file: url, route, selector: f.selector },
            message: f.message,
            suggestedFix: f.suggestedFix,
            confidence: 0.6, // taste pass is non-deterministic-ish; ranker downweights
            vdiImpact: { quality: 0.8, risk: 0.2, readiness: 0.4 },
            firstSeen: now,
            lastSeen: now,
          });
        }
      } catch {
        // skip route on navigation/screenshot failure
      } finally {
        await page.close();
      }
    }

    return findings;
  },
};
