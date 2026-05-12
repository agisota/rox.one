import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Finding, Probe, ProbeContext } from "../probe.ts";
import { computeFindingId, FINDING_SCHEMA_VERSION } from "../probe.ts";

export const staticBundleProbe: Probe = {
  name: "static-bundle",
  phase: "A.1",
  applicableTo: () => true,
  async run(ctx: ProbeContext): Promise<Finding[]> {
    const budgetPath = join(ctx.surfaceRoot, "budget.json");
    if (!existsSync(budgetPath)) return [];

    let budget: Record<string, number>;
    try {
      budget = JSON.parse(readFileSync(budgetPath, "utf-8")) as Record<string, number>;
    } catch {
      return [];
    }

    const distRoot = ctx.buildOutputRoot ?? join(ctx.surfaceRoot, "dist");
    const now = new Date().toISOString();
    const findings: Finding[] = [];

    for (const [filename, maxBytes] of Object.entries(budget)) {
      const filePath = join(distRoot, filename);
      if (!existsSync(filePath)) continue;

      const actualBytes = statSync(filePath).size;
      if (actualBytes <= maxBytes) continue;

      const rule = "bundle:over-budget";
      const id = computeFindingId({ probe: "static-bundle", rule, file: filePath });
      const overage = actualBytes - maxBytes;
      const finding: Finding = {
        schemaVersion: FINDING_SCHEMA_VERSION,
        id,
        probe: "static-bundle",
        surface: ctx.surface,
        phase: "A.1",
        severity: "high",
        rule,
        location: { file: filePath },
        message: `${filename} is ${actualBytes} bytes, exceeds budget of ${maxBytes} bytes by ${overage} bytes`,
        confidence: 1,
        vdiImpact: { quality: 0.5, risk: 0.4, readiness: 0.3 },
        firstSeen: now,
        lastSeen: now,
      };
      findings.push(finding);
    }

    return findings;
  },
};
