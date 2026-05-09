import AxeBuilder from "@axe-core/playwright";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { discoverRoutes } from "../discovery.ts";
import type { Finding, Probe, ProbeContext } from "../probe.ts";
import { computeFindingId, FINDING_SCHEMA_VERSION } from "../probe.ts";

function severityForImpact(impact: string | null | undefined): Finding["severity"] {
  switch (impact) {
    case "critical": return "critical";
    case "serious":  return "high";
    case "moderate": return "medium";
    default:         return "low";
  }
}

export const runtimeAxeProbe: Probe = {
  name: "runtime-axe",
  phase: "A.2",
  applicableTo: () => true,
  async run(ctx: ProbeContext): Promise<Finding[]> {
    if (!ctx.playwright) return [];
    const routes = await discoverRoutes(ctx.surface, ctx.surfaceRoot, ctx.devServerUrl, ctx.playwright);
    const indexFile = join(ctx.surfaceRoot, "index.html");
    if (routes.length === 0 && !ctx.devServerUrl && !existsSync(indexFile)) return [];

    const findings: Finding[] = [];
    const now = new Date().toISOString();

    const targets = routes.length > 0
      ? routes.map((r) => ({
          route: r,
          url: ctx.devServerUrl
            ? new URL(r, ctx.devServerUrl).toString()
            : `file://${ctx.surfaceRoot}/src/pages${r === "/" ? "/index" : r}.html`,
        }))
      : ctx.devServerUrl
        ? [{ route: "/", url: ctx.devServerUrl }]
        : [{ route: "/", url: `file://${indexFile}` }];

    for (const target of targets) {
      const { url, route } = target;
      const page = await ctx.playwright.newPage();
      try {
        await page.goto(url, { waitUntil: "networkidle" });
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
          .analyze();
        for (const v of results.violations) {
          for (const node of v.nodes) {
            const nodeTarget = node.target.join(" ");
            const id = computeFindingId({
              probe: "runtime-axe",
              rule: `axe:${v.id}`,
              file: url,
              line: 0,
            });
            findings.push({
              schemaVersion: FINDING_SCHEMA_VERSION,
              id,
              probe: "runtime-axe",
              surface: ctx.surface,
              phase: "A.2",
              severity: severityForImpact(v.impact),
              rule: `axe:${v.id}`,
              location: { file: url, selector: nodeTarget, route },
              message: v.description,
              evidence: { codeSnippet: node.html },
              suggestedFix: v.help,
              confidence: 1,
              vdiImpact: { quality: 0.7, risk: 0.5, readiness: 0.6 },
              firstSeen: now,
              lastSeen: now,
            });
          }
        }
      } finally {
        await page.close();
      }
    }

    return findings;
  },
};
